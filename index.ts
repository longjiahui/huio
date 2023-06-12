import { Stream } from './src/base'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'

const serverStream = new Stream('server', () => {
    const server = createServer()
    const io = new Server(server, {
        cors: {
            origin: ['*'],
        },
    })
    const connectionStream = new Stream<[Socket]>('connection', async () => {
        return new Promise((r) => {
            server.on('close', r)
        })
    })
    io.on('connect', async (socket) => {
        await connectionStream.go(socket)
    })
    io.listen(3000)
    console.debug('server listened on 3000')
})

serverStream.go()
