import { Layer } from './lib/layer'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import { routeControllers } from './router'
import { Controller } from './controller'
import { HuioError } from '@/error'

interface AppSettingSchema {
    port?: number
    controllers: (typeof Controller)[]
}

class ServerLayer extends Layer<AppSettingSchema> {}

export class App {
    public serverLayer: ServerLayer = new ServerLayer((setting) => {
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
        connectionLayer.install(async (next, socket) => {
            const { routes } = await routeControllers(this.setting.controllers)
            for (const r of Object.keys(routes)) {
                socket.on(r, async (...rest: any[]) => {
                    const ret: (...rest: any[]) => void = rest.slice(-1)[0]
                    const params = rest.slice(0, rest.length - 1)
                    const returnDatas = await routes[r]?.(...params)
                    if (returnDatas instanceof Array) {
                        ret(...returnDatas)
                    } else {
                        throw new HuioError(`Controllers(${r}) 返回格式错误`)
                    }
                })
            }
            return next(socket)
        })
        io.on('connect', async (socket) => {
            await connectionLayer.go(socket)
        })
        server.listen(setting.port)
        console.debug(`server listened on ${JSON.stringify(server.address())}`)
    })

    constructor(public setting: AppSettingSchema) {}

    start() {
        return this.serverLayer.go(this.setting)
    }
}
