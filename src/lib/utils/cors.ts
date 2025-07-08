const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://flags.games",
  "https://www.flags.games",
];

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: Change this later
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
};

export const handleCors = (origin: string | null): Record<string, string> => {
  const isAllowedOrigin = origin ? allowedOrigins.includes(origin) : true;

  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin || "*" : "null",
  };
};

export const isOriginAllowed = (origin: string | null): boolean => {
  return origin ? allowedOrigins.includes(origin) : true;
};
