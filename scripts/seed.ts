import 'dotenv/config';
import { prisma } from '../client';
import { hash } from 'argon2';

async function seed() {
	// Clean existing data
	await prisma.message.deleteMany();
	await prisma.conversation.deleteMany();
	await prisma.apiKey.deleteMany();
	await prisma.session.deleteMany();
	await prisma.user.deleteMany();

	// Create users with hashed passwords
	const user1Id = crypto.randomUUID();
	const user2Id = crypto.randomUUID();
	const user3Id = crypto.randomUUID();

	const passwordHash1 = await hash('password123');
	const passwordHash2 = await hash('securepass456');
	const passwordHash3 = await hash('mypassword789');

	const user1 = await prisma.user.create({
		data: {
			id: user1Id,
			email: 'john.doe@example.com',
			passwordHash: passwordHash1,
			name: 'John Doe',
		},
	});

	const user2 = await prisma.user.create({
		data: {
			id: user2Id,
			email: 'jane.smith@example.com',
			passwordHash: passwordHash2,
			name: 'Jane Smith',
		},
	});

	const user3 = await prisma.user.create({
		data: {
			id: user3Id,
			email: 'alex.wilson@example.com',
			passwordHash: passwordHash3,
			name: 'Alex Wilson',
		},
	});

	// Create sessions
	const session1 = await prisma.session.create({
		data: {
			id: crypto.randomUUID(),
			userId: user1Id,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
		},
	});

	const session2 = await prisma.session.create({
		data: {
			id: crypto.randomUUID(),
			userId: user2Id,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
		},
	});

	// Create API keys
	await prisma.apiKey.create({
		data: {
			id: crypto.randomUUID(),
			userId: user1Id,
			key: 'sk-test-john-' + crypto.randomUUID().slice(0, 8),
			name: 'John\'s Development Key',
		},
	});

	await prisma.apiKey.create({
		data: {
			id: crypto.randomUUID(),
			userId: user2Id,
			key: 'sk-test-jane-' + crypto.randomUUID().slice(0, 8),
			name: 'Jane\'s Production Key',
		},
	});

	// Create conversations
	const conv1 = await prisma.conversation.create({
		data: {
			id: crypto.randomUUID(),
			userId: user1Id,
			title: 'React Best Practices',
			provider: 'openai',
			model: 'gpt-4o-mini',
			systemPrompt: 'You are a helpful coding assistant specializing in React and TypeScript.',
		},
	});

	const conv2 = await prisma.conversation.create({
		data: {
			id: crypto.randomUUID(),
			userId: user1Id,
			title: 'Database Design Discussion',
			provider: 'anthropic',
			model: 'claude-3-5-sonnet-20241022',
			systemPrompt: 'You are an expert database architect.',
		},
	});

	const conv3 = await prisma.conversation.create({
		data: {
			id: crypto.randomUUID(),
			userId: user2Id,
			title: 'API Development Help',
			provider: 'openrouter',
			model: 'openai/gpt-4o-mini',
			systemPrompt: 'You are a backend development expert.',
		},
	});

	// Create messages
	await prisma.message.createMany({
		data: [
			{
				id: crypto.randomUUID(),
				conversationId: conv1.id,
				role: 'user',
				content: 'What are the best practices for React hooks?',
				tokens: 12,
			},
			{
				id: crypto.randomUUID(),
				conversationId: conv1.id,
				role: 'assistant',
				content: 'Here are some key best practices for React hooks:\n\n1. Always call hooks at the top level\n2. Only call hooks from React functions\n3. Use useCallback for memoizing functions\n4. Use useMemo for expensive calculations\n5. Keep hooks small and focused',
				tokens: 45,
			},
			{
				id: crypto.randomUUID(),
				conversationId: conv1.id,
				role: 'user',
				content: 'Can you explain useCallback with an example?',
				tokens: 10,
			},
			{
				id: crypto.randomUUID(),
				conversationId: conv2.id,
				role: 'user',
				content: 'How should I design a schema for a multi-tenant application?',
				tokens: 13,
			},
			{
				id: crypto.randomUUID(),
				conversationId: conv2.id,
				role: 'assistant',
				content: 'For multi-tenant applications, consider these approaches:\n\n1. Row-level security with tenant_id columns\n2. Separate schemas per tenant\n3. Separate databases per tenant\n\nThe choice depends on your scale and isolation requirements.',
				tokens: 38,
			},
			{
				id: crypto.randomUUID(),
				conversationId: conv3.id,
				role: 'user',
				content: 'How do I implement JWT authentication in Node.js?',
				tokens: 12,
			},
			{
				id: crypto.randomUUID(),
				conversationId: conv3.id,
				role: 'assistant',
				content: 'Here\'s a basic JWT implementation:\n\n1. Install jsonwebtoken package\n2. Create a secret key\n3. Generate tokens on login\n4. Verify tokens on protected routes\n\nWould you like me to provide code examples?',
				tokens: 42,
			},
		],
	});

	console.log('✅ Seeded database with realistic data:');
	console.log(`   - 3 users (john.doe@example.com, jane.smith@example.com, alex.wilson@example.com)`);
	console.log(`   - 2 active sessions`);
	console.log(`   - 2 API keys`);
	console.log(`   - 3 conversations`);
	console.log(`   - 7 messages`);
}

seed()
	.catch((error) => {
		console.error('Error seeding database:', error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
