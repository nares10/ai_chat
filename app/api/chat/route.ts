import { NextRequest, NextResponse } from "next/server";

function streamSSE(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function streamOpenRouter(message: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to your .env.local file.");
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "rag-2",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorData = await upstream.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `OpenRouter request failed with status ${upstream.status}`
    );
  }

  return upstream;
}

async function streamOpenAI(message: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to your .env.local file.");
  }

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorData = await upstream.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `OpenAI request failed with status ${upstream.status}`);
  }

  return upstream;
}

async function streamAnthropic(message: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is missing. Add it to your .env.local file.");
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 1024,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorData = await upstream.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Anthropic request failed with status ${upstream.status}`
    );
  }

  return upstream;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const providerInput = typeof body?.provider === "string" ? body.provider : "";
    const normalizedProvider = (providerInput || process.env.AI_PROVIDER || "openrouter").toLowerCase();

    let upstream: Response;

    if (normalizedProvider === "openai") {
      upstream = await streamOpenAI(message);
    } else if (normalizedProvider === "anthropic" || normalizedProvider === "claude") {
      upstream = await streamAnthropic(message);
    } else {
      upstream = await streamOpenRouter(message);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        const reader = upstream.body!.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;

              const raw = line.replace(/^data:\s*/, "").trim();
              if (!raw || raw === "[DONE]") continue;

              try {
                const payload = JSON.parse(raw);

                let textChunk = "";

                if (normalizedProvider === "anthropic" || normalizedProvider === "claude") {
                  if (payload.type === "content_block_delta") {
                    textChunk = payload.delta?.text || "";
                  }
                } else {
                  textChunk = payload?.choices?.[0]?.delta?.content || "";
                }

                if (textChunk) {
                  controller.enqueue(encoder.encode(streamSSE({ text: textChunk })));
                }
              } catch {
                // ignore malformed provider chunks
              }
            }
          }

          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Streaming error while contacting the AI provider.";

          controller.enqueue(encoder.encode(streamSSE({ error: message })));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong while contacting the AI provider.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
