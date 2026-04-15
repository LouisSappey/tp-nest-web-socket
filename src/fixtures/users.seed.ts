import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';

async function seedUsers() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const usersService = app.get(UsersService);

    const fixtures = [
      {
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
        displayColor: '#ef4444',
      },
      {
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123',
        displayColor: '#22c55e',
      },
      {
        username: 'charlie',
        email: 'charlie@example.com',
        password: 'password123',
        displayColor: '#3b82f6',
      },
    ];

    for (const fixture of fixtures) {
      const existing = await usersService.findByEmail(fixture.email);
      if (existing) {
        continue;
      }

      const hashedPassword = await bcrypt.hash(fixture.password, 10);
      await usersService.create({
        username: fixture.username,
        email: fixture.email,
        password: hashedPassword,
        displayColor: fixture.displayColor,
      });
    }

    process.stdout.write('Users fixtures seeded successfully.\n');
  } finally {
    await app.close();
  }
}

seedUsers().catch((error: unknown) => {
  process.stderr.write(`Failed to seed users fixtures: ${String(error)}\n`);
  process.exit(1);
});
