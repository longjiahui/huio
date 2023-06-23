import { Layer } from './lib/layer'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import { mapAllRoutes } from '../controller/controller'
import { HuioError } from '../error'

interface AppSettingSchema {
    port?: number
}

class ServerLayer extends Layer<AppSettingSchema> {}

export class App {
    public serverLayer: ServerLayer
    constructor(public setting: AppSettingSchema) {
        this.serverLayer = new ServerLayer((setting) => {
            const server = createServer()
            const io = new Server(server, {
                cors: {
                    origin: ['*'],
                },
            })
            const connectionLayer = new Layer<Socket>(async () => {
                return new Promise((r) => {
                    server.on('close', r)
                })
            })
            connectionLayer.install((next, socket) => {
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
                return next(socket)
            })
            io.on('connect', async (socket) => {
                await connectionLayer.go(socket)
            })
            server.listen(setting.port)
            console.debug(
                `server listened on ${JSON.stringify(server.address())}`,
            )
        })
    }

    start() {
        return this.serverLayer.go(this.setting)
    }
}
