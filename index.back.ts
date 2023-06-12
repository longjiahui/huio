import { Server } from 'socket.io'
import { createServer } from 'http'
import process from 'process'
import { connectionAuthGuard } from './src/guard/connectAuth'
import { glob } from 'glob'
import path from 'path'

const server = createServer()
const io = new Server(server, {
    cors: {
        origin: ['*'],
    },
})

// Global Error Handler
process.on('uncaughtException', (err, origin) => {
    console.debug(err, origin)
})

// Guard
// io.use(connectionAuthGuard)

glob('./src/controller/**/*.ts', { ignore: '**/*.d.ts' })
    .then((ps) =>
        ps
            .map((p) => require(path.resolve(p))?.default)
            .filter((controller) => !!controller),
    )
    .then((controllers) => {
        for (let c of controllers) {
            Object.keys(c)
        }
    })

io.sockets.on('connect', (socket) => {
    console.debug('connection built: ', socket.id)
})

const port = 3000
server.listen(port, () =>
    console.debug(
        `socket.io now is listening on ${JSON.stringify(server.address())}`,
    ),
)
