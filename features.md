
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
- **Email Verification in Signup**: Registration collects name and email, mails a 6-digit code, and only creates the account once the code is confirmed and a password is set

## Next:
- Add message search functionality
- 
- 12 Test failed , look into that 
- Dockerise Application
- Add export conversation feature

## Fixes
- Fix free message count not updating after sending a message