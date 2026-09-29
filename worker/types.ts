import type { Role } from "./db/schema";

export type Me = {
  personId: number;
  name: string;
  roles: Role[];
  sessionId: number;
};

export type AppEnv = {
  Bindings: Env;
  Variables: { me: Me };
};
