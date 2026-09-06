import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { FREE_MESSAGE_LIMIT } from "@/lib/freeMessages";

function streamSSE(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function streamOpenRouter(messages: Array<{ role: string; content: string }>, userApiKey?: string) {
  const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to your .env.local file or provide an API key.");
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
      messages,
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

async function streamOpenAI(messages: Array<{ role: string; content: string }>, userApiKey?: string) {
  const apiKey = userApiKey || process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to your .env.local file or provide an API key.");
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
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorData = await upstream.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `OpenAI request failed with status ${upstream.status}`);
  }

  return upstream;
}

async function streamAnthropic(messages: Array<{ role: string; content: string }>, userApiKey?: string) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is missing. Add it to your .env.local file or provide an API key.");
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
      messages,
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
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const providerInput = typeof body?.provider === "string" ? body.provider : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey : null;
    const normalizedProvider = (providerInput || process.env.AI_PROVIDER || "openrouter").toLowerCase();

    // Check free message limit if no API key provided
    if (!apiKey) {
      if (user.freeMessagesUsed >= FREE_MESSAGE_LIMIT) {
        return NextResponse.json(
          { 
            error: "Free message limit reached",
            message: `You've used your ${FREE_MESSAGE_LIMIT} free messages. Please add an API key to continue.`,
            requiresApiKey: true
          }, 
          { status: 403 }
        );
      }

      // Increment free message counter
      await prisma.user.update({
        where: { id: user.id },
        data: { freeMessagesUsed: { increment: 1 } }
      });
    }

    // Create or get conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: user.id,
        },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          provider: normalizedProvider,
        },
      });
    }

    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message,
      },
    });

    // Get conversation history for context
    const conversationHistory = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // Limit to last 10 messages for context
    });

    // Format messages for AI providers
    const messagesForAI = conversationHistory.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    let upstream: Response;

    if (normalizedProvider === "openai") {
      upstream = await streamOpenAI(messagesForAI, apiKey || undefined);
    } else if (normalizedProvider === "anthropic" || normalizedProvider === "claude") {
      upstream = await streamAnthropic(messagesForAI, apiKey || undefined);
    } else {
      upstream = await streamOpenRouter(messagesForAI, apiKey || undefined);
    }

    const encoder = new TextEncoder();
    let fullResponse = "";
    
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
                  fullResponse += textChunk;
                  controller.enqueue(encoder.encode(streamSSE({ text: textChunk })));
                }
              } catch {
                // ignore malformed provider chunks
              }
            }
          }

          // Save assistant message to database after streaming is complete
          if (fullResponse) {
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: "assistant",
                content: fullResponse,
              },
            });
          }

          // Send conversation ID at the end
          controller.enqueue(encoder.encode(streamSSE({ conversationId: conversation.id, done: true })));
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
