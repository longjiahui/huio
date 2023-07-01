import { Layer } from './lib/layer'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import { router } from './router'
import { Controller } from './controller'
import { dic } from './dic'
import { createDIC } from './lib/di'

interface AppSettingSchema {
    port?: number
    controllers: (typeof Controller)[]
}

class ServerLayer extends Layer<AppSettingSchema> {}
class EventLayer extends Layer<[(...rest: any[]) => Awaited<any>, ...any[]]> {}

export class App {
    public eventLayer: EventLayer
    public serverLayer: ServerLayer = new ServerLayer(async (setting) => {
        const server = createServer()
        const io = new Server(server, {
            cors: {
                origin: '*',
            },
        })

        // preload routes
        const { routes } = await router.getControllersRoutes(
            this.setting.controllers,
            dic,
        )

        const connectionLayer = new Layer<Socket>(async () => {
            return new Promise((r) => {
                server.on('close', r)
            })
        })
        connectionLayer.install(async (next, socket) => {
            const { dic: newDIC, Provide: newProvide } = createDIC(dic)
            newProvide(() => socket)(Socket)
            socket.onAny(async (event: string, ...rest: any[]) => {
                const routeItem = routes[event]
                if (routeItem) {
                    const c = await newDIC.makeImmediately(routeItem.Controller)
                    const handler = (...rest) => c[routeItem.method](...rest)
                    this.eventLayer.go(handler, ...rest)
                } else {
                    console.debug('404: ', event)
                }
            })
            return next(socket)
        })
        io.on('connect', async (socket) => {
            await connectionLayer.go(socket)
        })
        server.listen(setting.port)
        console.debug(`server listened on ${JSON.stringify(server.address())}`)
    })

    constructor(public setting: AppSettingSchema) {
        this.eventLayer = new EventLayer(async (handler, ...rest: any) => {
            const ret: (...rest: any[]) => void = rest.slice(-1)[0]
            const params = rest.slice(0, rest.length - 1)
            const returnDatas = (await handler?.(...params)) || []
            if (returnDatas instanceof Array) {
                ret(...returnDatas)
            } else {
                ret(returnDatas)
            }
        })
    }

    async start() {
        return this.serverLayer.go(this.setting)
    }
}
