import { HEADERS } from "../headers/headers";

/**
 * 
 * @param {{ email: string, password: string }, password: string} user 
 * @returns {Promise<string>} token
 */
async function loginUser(request, user, password) {
  const res = await request.post("/api/auth/login")
    .set(HEADERS.formUrlEncoded)
    .send({ email: user.email, password })
  return res.body.tok
}
export default loginUser;