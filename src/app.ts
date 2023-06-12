import { Stream } from './base'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import { mapAllRoutes } from './controller/controller'
import { HuioError } from './error'

interface AppSettingSchema {
    port?: number
    // controllers?: (new (...rest: any[]) => any)[]
}

class ServerStream extends Stream<[AppSettingSchema]> {}

export class App {
    public serverStream: ServerStream
    constructor(public setting: AppSettingSchema) {
        this.serverStream = new ServerStream('server', (stream, setting) => {
            const server = createServer()
            const io = new Server(server, {
                cors: {
                    origin: ['*'],
                },
            })
            const connectionStream = new Stream<[Socket]>(
                'connection',
                async () => {
                    return new Promise((r) => {
                        server.on('close', r)
                    })
                },
            )
            connectionStream.install((next, stream, socket) => {
                mapAllRoutes().forEach((r) => {
                    socket.on(r.path, async (...rest: any[]) => {
                        const ret: (...rest: any[]) => void = rest.slice(-1)[0]
                        const params = rest.slice(0, rest.length - 1)
                        const returnDatas = await r.handler(...params)
                        if (returnDatas instanceof Array) {
                            ret(...returnDatas)
                        } else {
                            throw new HuioError(
                                `Controllers(${r.path}) 返回格式错误`,
                            )
                        }
                    })
                })
                next()
            })
            io.on('connect', async (socket) => {
                await connectionStream.go(socket)
            })
            server.listen(setting.port)
            console.debug(
                `server listened on ${JSON.stringify(server.address())}`,
            )
        })
    }

    start() {
        return this.serverStream.go(this.setting)
    }
}
