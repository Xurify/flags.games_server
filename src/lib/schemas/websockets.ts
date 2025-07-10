import { z } from 'zod';
import {
  UsernameSchema,
  UserIdSchema,
  RoomNameSchema,
  AnswerSchema,
  InviteCodeSchema,
  RoomSettingsSchema
} from '../utils/validation';

const BaseMessageSchema = z.object({
  type: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.number().optional(),
});

// TODO: Might implement randomized room name in the future

export const CreateRoomDataSchema = z.object({
  username: UsernameSchema,
  //roomName: RoomNameSchema,
  settings: RoomSettingsSchema.partial().optional(),
});

export const JoinRoomDataSchema = z.object({
  inviteCode: InviteCodeSchema,
  username: UsernameSchema,
});

export const SubmitAnswerDataSchema = z.object({
  answer: AnswerSchema,
  questionId: z.string().optional(),
});

export const UpdateSettingsDataSchema = z.object({
  settings: RoomSettingsSchema.partial(),
});

export const KickUserDataSchema = z.object({
  userId: UserIdSchema,
});

export const AuthDataSchema = z.object({
  token: z.string().min(1),
  adminToken: z.string().optional(),
});

export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  BaseMessageSchema.extend({
    type: z.literal('AUTH'),
    data: AuthDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('CREATE_ROOM'),
    data: CreateRoomDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('JOIN_ROOM'),
    data: JoinRoomDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('SUBMIT_ANSWER'),
    data: SubmitAnswerDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('UPDATE_SETTINGS'),
    data: UpdateSettingsDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.literal('KICK_USER'),
    data: KickUserDataSchema,
  }),
  BaseMessageSchema.extend({
    type: z.enum([
      'LEAVE_ROOM',
      'START_GAME',
      'TOGGLE_READY',
      'PAUSE_GAME',
      'RESUME_GAME',
      'STOP_GAME',
      'HEARTBEAT_RESPONSE'
    ]),
    data: z.record(z.unknown()).optional(),
  }),
]);

export type CreateRoomData = z.infer<typeof CreateRoomDataSchema>;
export type JoinRoomData = z.infer<typeof JoinRoomDataSchema>;
export type SubmitAnswerData = z.infer<typeof SubmitAnswerDataSchema>;
export type UpdateSettingsData = z.infer<typeof UpdateSettingsDataSchema>;
export type KickUserData = z.infer<typeof KickUserDataSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
