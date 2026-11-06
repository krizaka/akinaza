import { AUTH, createAuth } from "@krizaka/app-client/react";

import { folioviv, session } from "./config";

/** Who is using the app, followed when a session starts or ends (a 401 included): `@krizaka/app-client/react`. */
export const { AuthProvider, useAuth } = createAuth(session, { signIn: folioviv.signIn, signOut: folioviv.signOut });
export { AUTH };
