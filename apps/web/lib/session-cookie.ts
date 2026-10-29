import { cookieName } from "./cookie";

/** The web session's cookie name, alone so the proxy (edge) can read it without the database behind `./session`. Host-locked where the origin is https (akinaza#534). */
export const SESSION_COOKIE = cookieName("akinaza_session");
