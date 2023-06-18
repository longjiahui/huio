import { Layer } from './src/framework/lib/layer'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'

const serverLayer = new Layer('server', () => {
    const server = createServer()
    const io = new Server(server, {
        cors: {
            origin: ['*'],
        },
    })
    const connectionLayer = new Layer<[Socket]>('connection', async () => {
        return new Promise((r) => {
            server.on('close', r)
        })
    })
    io.on('connect', async (socket) => {
        await connectionLayer.go(socket)
    })
    io.listen(3000)
    console.debug('server listened on 3000')
})

serverLayer.go()
