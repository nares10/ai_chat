
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
- **Conversation History**: List of conversations with provider information
- **API Key Management**: Save, list, and manage provider API keys
- **Profile Dashboard**: View account details, usage, conversations, and providers
- **Conversation Management**: Rename and delete conversations

## Next:
- Add message search functionality
- Investigate the 12 failing tests
- Containerise the application using Docker
- Email Verification in Signup process
