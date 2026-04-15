import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';

type JwtPayload = {
  id: number;
  email: string;
  iat?: number;
  exp?: number;
};

type ConnectedUser = {
  userId: number;
  username: string;
  email: string;
  displayColor: string;
};

type ReactionUser = {
  userId: number;
  username: string;
  displayColor: string;
};

type MessageReaction = {
  emoji: string;
  users: ReactionUser[];
};

type ChatMessage = {
  id: string;
  content: string;
  sentAt: string;
  author: {
    userId: number;
    username: string;
    email: string;
    displayColor: string;
  };
  reactions: MessageReaction[];
};

type RoomMembership = {
  userId: number;
  canReadHistory: boolean;
};

type ChatRoom = {
  id: string;
  name: string;
  createdBy: number;
  createdAt: string;
  members: RoomMembership[];
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly roomName = 'general';
  private readonly connectedUsersBySocketId = new Map<string, ConnectedUser>();
  private readonly typingSocketIds = new Set<string>();
  private readonly messagesByRoom = new Map<string, Map<string, ChatMessage>>();
  private readonly rooms = new Map<string, ChatRoom>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  afterInit() {
    this.ensureGeneralRoom();
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'dev_secret'),
      });
    } catch {
      client.disconnect();
      return;
    }

    if (this.authService.isTokenRevoked(token)) {
      client.disconnect();
      return;
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      client.disconnect();
      return;
    }

    const connectedUser: ConnectedUser = {
      userId: user.id,
      username: user.username,
      email: user.email,
      displayColor: user.displayColor,
    };

    this.connectedUsersBySocketId.set(client.id, connectedUser);
    await client.join(this.roomName);
    this.joinUserRooms(client, connectedUser.userId);

    client.emit('chat:connected', {
      room: this.roomName,
      currentUser: connectedUser,
      onlineUsers: this.getUniqueOnlineUsers(),
      messages: this.getMessages(this.roomName),
      rooms: this.getUserRooms(connectedUser.userId),
    });

    this.server.to(this.roomName).emit('chat:online_users', this.getUniqueOnlineUsers());
    this.emitTypingUsers();
  }

  handleDisconnect(client: Socket) {
    this.typingSocketIds.delete(client.id);
    this.connectedUsersBySocketId.delete(client.id);
    this.server.to(this.roomName).emit('chat:online_users', this.getUniqueOnlineUsers());
    this.emitTypingUsers();
  }

  @SubscribeMessage('chat:send_message')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { content?: string; roomId?: string },
  ) {
    const currentUser = this.connectedUsersBySocketId.get(client.id);
    const roomId = body?.roomId?.trim() || this.roomName;
    const content = body?.content?.trim();
    if (!currentUser || !content || !this.hasRoomAccess(roomId, currentUser.userId)) {
      return { ok: false };
    }

    this.typingSocketIds.delete(client.id);
    this.emitTypingUsers();

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      sentAt: new Date().toISOString(),
      author: {
        userId: currentUser.userId,
        username: currentUser.username,
        email: currentUser.email,
        displayColor: currentUser.displayColor,
      },
      reactions: [],
    };

    this.getRoomMessagesStore(roomId).set(message.id, message);
    this.server.to(roomId).emit('chat:new_message', { roomId, message });
    return { ok: true, message };
  }

  @SubscribeMessage('chat:get_online_users')
  handleGetOnlineUsers() {
    return { onlineUsers: this.getUniqueOnlineUsers() };
  }

  @SubscribeMessage('chat:get_messages')
  handleGetMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string },
  ) {
    const currentUser = this.connectedUsersBySocketId.get(client.id);
    const roomId = body?.roomId?.trim() || this.roomName;
    if (!currentUser || !this.hasRoomAccess(roomId, currentUser.userId)) {
      return { ok: false, messages: [] };
    }
    return { ok: true, roomId, messages: this.getMessages(roomId) };
  }

  @SubscribeMessage('chat:typing_start')
  handleTypingStart(@ConnectedSocket() client: Socket) {
    if (!this.connectedUsersBySocketId.has(client.id)) {
      return { ok: false };
    }

    this.typingSocketIds.add(client.id);
    this.emitTypingUsers();
    return { ok: true };
  }

  @SubscribeMessage('chat:typing_stop')
  handleTypingStop(@ConnectedSocket() client: Socket) {
    if (!this.connectedUsersBySocketId.has(client.id)) {
      return { ok: false };
    }

    this.typingSocketIds.delete(client.id);
    this.emitTypingUsers();
    return { ok: true };
  }

  @SubscribeMessage('chat:toggle_reaction')
  handleToggleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string; messageId?: string; emoji?: string },
  ) {
    const currentUser = this.connectedUsersBySocketId.get(client.id);
    const roomId = body?.roomId?.trim() || this.roomName;
    const messageId = body?.messageId?.trim();
    const emoji = body?.emoji?.trim();

    if (!currentUser || !messageId || !emoji || !this.hasRoomAccess(roomId, currentUser.userId)) {
      return { ok: false };
    }

    const roomMessages = this.getRoomMessagesStore(roomId);
    const message = roomMessages.get(messageId);
    if (!message) {
      return { ok: false };
    }

    const reactionUser: ReactionUser = {
      userId: currentUser.userId,
      username: currentUser.username,
      displayColor: currentUser.displayColor,
    };

    const existingReaction = message.reactions.find((reaction) => reaction.emoji === emoji);
    if (!existingReaction) {
      message.reactions.push({
        emoji,
        users: [reactionUser],
      });
    } else {
      const existingUserIndex = existingReaction.users.findIndex(
        (user) => user.userId === currentUser.userId,
      );

      if (existingUserIndex >= 0) {
        existingReaction.users.splice(existingUserIndex, 1);
      } else {
        existingReaction.users.push(reactionUser);
      }

      if (existingReaction.users.length === 0) {
        message.reactions = message.reactions.filter((reaction) => reaction.emoji !== emoji);
      }
    }

    roomMessages.set(message.id, message);
    this.server.to(roomId).emit('chat:message_reactions_updated', {
      roomId,
      messageId: message.id,
      reactions: message.reactions,
    });

    return {
      ok: true,
      roomId,
      messageId: message.id,
      reactions: message.reactions,
    };
  }

  @SubscribeMessage('chat:create_room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { name?: string; memberIds?: number[]; invitedCanReadHistory?: boolean },
  ) {
    const currentUser = this.connectedUsersBySocketId.get(client.id);
    const name = body?.name?.trim();
    const memberIds = Array.isArray(body?.memberIds) ? body.memberIds : [];
    const invitedCanReadHistory = body?.invitedCanReadHistory === true;
    if (!currentUser || !name) {
      return { ok: false };
    }

    const invitedUsers = await this.usersService.findByIds(
      memberIds.filter((id) => Number.isInteger(id) && id > 0 && id !== currentUser.userId),
    );

    const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const room: ChatRoom = {
      id: roomId,
      name,
      createdBy: currentUser.userId,
      createdAt: new Date().toISOString(),
      members: [
        { userId: currentUser.userId, canReadHistory: true },
        ...invitedUsers.map((user) => ({
          userId: user.id,
          canReadHistory: invitedCanReadHistory,
        })),
      ],
    };

    this.rooms.set(roomId, room);
    this.getRoomMessagesStore(roomId);
    this.server.to(client.id).socketsJoin(roomId);
    for (const invitedUser of invitedUsers) {
      for (const [socketId, connected] of this.connectedUsersBySocketId.entries()) {
        if (connected.userId === invitedUser.id) {
          this.server.to(socketId).socketsJoin(roomId);
          this.server.to(socketId).emit('chat:room_invited', {
            room: this.toClientRoom(room, invitedUser.id),
            messages: invitedCanReadHistory ? this.getMessages(roomId) : [],
          });
        }
      }
    }

    const creatorRoom = this.toClientRoom(room, currentUser.userId);
    client.emit('chat:room_created', { room: creatorRoom });
    return { ok: true, room: creatorRoom };
  }

  @SubscribeMessage('chat:get_rooms')
  handleGetRooms(@ConnectedSocket() client: Socket) {
    const currentUser = this.connectedUsersBySocketId.get(client.id);
    if (!currentUser) {
      return { ok: false, rooms: [] };
    }
    return { ok: true, rooms: this.getUserRooms(currentUser.userId) };
  }

  @SubscribeMessage('chat:invite_to_room')
  async handleInviteToRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string; userId?: number; canReadHistory?: boolean },
  ) {
    const inviter = this.connectedUsersBySocketId.get(client.id);
    const roomId = body?.roomId?.trim();
    const invitedUserId = Number(body?.userId);
    const canReadHistory = body?.canReadHistory === true;

    if (!inviter || !roomId || !Number.isInteger(invitedUserId) || invitedUserId <= 0) {
      return { ok: false };
    }

    if (roomId === this.roomName) {
      return { ok: false };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { ok: false };
    }

    if (!room.members.some((member) => member.userId === inviter.userId)) {
      return { ok: false };
    }

    const invitedUser = await this.usersService.findById(invitedUserId);
    if (!invitedUser) {
      return { ok: false };
    }

    const existingMembership = room.members.find((member) => member.userId === invitedUser.id);
    if (existingMembership) {
      if (canReadHistory) {
        existingMembership.canReadHistory = true;
      }
    } else {
      room.members.push({
        userId: invitedUser.id,
        canReadHistory,
      });
    }

    this.rooms.set(room.id, room);

    for (const [socketId, connected] of this.connectedUsersBySocketId.entries()) {
      if (connected.userId === invitedUser.id) {
        this.server.to(socketId).socketsJoin(room.id);
        this.server.to(socketId).emit('chat:room_invited', {
          room: this.toClientRoom(room, invitedUser.id),
          messages: this.canUserReadHistory(room, invitedUser.id) ? this.getMessages(room.id) : [],
        });
      }
    }

    return {
      ok: true,
      room: this.toClientRoom(room, inviter.userId),
    };
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const headerToken = client.handshake.headers.authorization;
    if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
      return headerToken.replace(/^Bearer\s+/i, '').trim();
    }

    return null;
  }

  private getUniqueOnlineUsers(): ConnectedUser[] {
    return Array.from(
      new Map(
        Array.from(this.connectedUsersBySocketId.values()).map((user) => [user.userId, user]),
      ).values(),
    );
  }

  private emitTypingUsers() {
    const typingUsers = Array.from(this.typingSocketIds)
      .map((socketId) => this.connectedUsersBySocketId.get(socketId))
      .filter((user): user is ConnectedUser => Boolean(user));

    const uniqueTypingUsers = Array.from(
      new Map(typingUsers.map((user) => [user.userId, user])).values(),
    );

    this.server.to(this.roomName).emit('chat:typing_users', {
      users: uniqueTypingUsers,
      usernames: uniqueTypingUsers.map((user) => user.username),
      isAnyoneTyping: uniqueTypingUsers.length > 0,
    });
  }

  private getMessages(roomId: string): ChatMessage[] {
    const roomMessages = this.getRoomMessagesStore(roomId);
    return Array.from(roomMessages.values()).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  private getRoomMessagesStore(roomId: string): Map<string, ChatMessage> {
    const existing = this.messagesByRoom.get(roomId);
    if (existing) {
      return existing;
    }
    const created = new Map<string, ChatMessage>();
    this.messagesByRoom.set(roomId, created);
    return created;
  }

  private ensureGeneralRoom() {
    if (this.rooms.has(this.roomName)) {
      return;
    }
    this.rooms.set(this.roomName, {
      id: this.roomName,
      name: 'General',
      createdBy: 0,
      createdAt: new Date().toISOString(),
      members: [],
    });
    this.getRoomMessagesStore(this.roomName);
  }

  private hasRoomAccess(roomId: string, userId: number): boolean {
    if (roomId === this.roomName) {
      return true;
    }
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    return room.members.some((member) => member.userId === userId);
  }

  private getUserRooms(userId: number) {
    return Array.from(this.rooms.values())
      .filter(
        (room) =>
          room.id === this.roomName || room.members.some((member) => member.userId === userId),
      )
      .map((room) => this.toClientRoom(room, userId));
  }

  private toClientRoom(room: ChatRoom, userId: number) {
    const membership = room.members.find((member) => member.userId === userId);
    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      createdAt: room.createdAt,
      canReadHistory: room.id === this.roomName ? true : (membership?.canReadHistory ?? false),
      memberIds: room.members.map((member) => member.userId),
    };
  }

  private canUserReadHistory(room: ChatRoom, userId: number): boolean {
    if (room.id === this.roomName) {
      return true;
    }
    return room.members.find((member) => member.userId === userId)?.canReadHistory ?? false;
  }

  private joinUserRooms(client: Socket, userId: number) {
    for (const room of this.rooms.values()) {
      if (room.id === this.roomName || room.members.some((member) => member.userId === userId)) {
        client.join(room.id);
      }
    }
  }
}
