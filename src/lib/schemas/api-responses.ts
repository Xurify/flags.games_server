import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  metrics: z.record(z.string(), z.unknown()),
});

export const RoomsResponseSchema = z.object({
  rooms: z.record(z.string(), z.unknown()),
  count: z.number(),
});

export const UsersResponseSchema = z.object({
  users: z.record(z.string(), z.unknown()),
  count: z.number(),
});

export const StatsResponseSchema = z.object({
  rooms: z.number(),
  users: z.number(),
  activeGames: z.number(),
  timestamp: z.string(),
  metrics: z.record(z.string(), z.unknown()),
});

export const RoomResponseSchema = z.object({
  room: z.unknown(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type RoomsResponse = z.infer<typeof RoomsResponseSchema>;
export type UsersResponse = z.infer<typeof UsersResponseSchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
export type RoomResponse = z.infer<typeof RoomResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
