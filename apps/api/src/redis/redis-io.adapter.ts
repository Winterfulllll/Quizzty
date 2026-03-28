import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server as HttpServer } from 'node:http';
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    httpServer: HttpServer,
    private readonly redisUrl: string,
  ) {
    super(httpServer);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(this.redisUrl);
    const subClient = pubClient.duplicate();

    await Promise.all([
      new Promise<void>((resolve) => pubClient.on('connect', resolve)),
      new Promise<void>((resolve) => subClient.on('connect', resolve)),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const server: Server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
