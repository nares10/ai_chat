
# Features

## Implemented:
- **Basic Chat UI**: Clean, modern interface with message composer
- **Multiple AI Providers**: Support for OpenRouter, OpenAI, and Anthropic/Claude
- **Streaming Responses**: Real-time streaming of AI responses
- **Provider Selection**: Dropdown to switch between AI providers
- **Database Schema**: Complete schema with User, Session, Conversation, Message, and ApiKey models
- **Traditional Prisma Setup**: Migrated from Prisma Next to traditional Prisma 6.x
- **Seed Data**: Realistic seed data with users, sessions, conversations, messages, and API keys
- **Password Hashing**: Argon2 integration for secure password storage
- **Authentication UI**: Login and registration pages with form validation

## Next:
- [ ] Add message history (persist chat messages to database)
- [ ] Add API key management (create, list, delete API keys)
- [ ] Add user profile page
- [ ] Add conversation creation/deletion
- [ ] Add system prompt customization per conversation
- [ ] Add model selection per conversation
- [ ] Add message search functionality
- [ ] Add export conversation feature
- [ ] Add dark/light theme toggle
