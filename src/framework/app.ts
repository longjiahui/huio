import { Layer } from './lib/layer'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import { routeControllers } from './router'
import { Controller } from './controller'
import { HuioError } from '@/error'
import { dic } from './dic'
import { createDIC } from './lib/di'

interface AppSettingSchema {
    port?: number
    controllers: (typeof Controller)[]
}

class ServerLayer extends Layer<AppSettingSchema> {}
class EventLayer extends Layer<[Socket, string /* event */, ...any[]]> {}

export class App {
    public eventLayer: EventLayer
    public serverLayer: ServerLayer = new ServerLayer((setting) => {
        const server = createServer()
        const io = new Server(server, {
            cors: {
                origin: '*',
            },
        })
        const connectionLayer = new Layer<Socket>(async () => {
            return new Promise((r) => {
                server.on('close', r)
            })
        })
        connectionLayer.install(async (next, socket) => {
            socket.onAny((event: string, ...rest: any[]) =>
                this.eventLayer.go(socket, event, ...rest),
            )
            return next(socket)
        })
        io.on('connect', async (socket) => {
            await connectionLayer.go(socket)
        })
        server.listen(setting.port)
        console.debug(`server listened on ${JSON.stringify(server.address())}`)
    })

    constructor(public setting: AppSettingSchema) {
        this.eventLayer = new EventLayer(
            async (socket, event, ...rest: any[]) => {
                const { dic: newDIC, Provide: newProvide } = createDIC(dic)
                newProvide(() => socket)(Socket)
                const { routes } = await routeControllers(
                    this.setting.controllers,
                    newDIC,
                )
                const ret: (...rest: any[]) => void = rest.slice(-1)[0]
                const params = rest.slice(0, rest.length - 1)
                const returnDatas = (await routes[event]?.(...params)) || []
                if (returnDatas instanceof Array) {
                    ret(...returnDatas)
                } else {
                    throw new HuioError(`Controllers(${event}) 返回格式错误`)
                }
            },
        )
    }

    async start() {
        return this.serverLayer.go(this.setting)
    }
}
