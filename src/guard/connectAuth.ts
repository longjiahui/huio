import { Middleware } from './guard'

export const connectionAuthGuard = ((socket, next) => {
    if (!socket.handshake.headers.authorization) {
        throw new Error('auth failed')
    } else {
        next()
    }
}) as Middleware
