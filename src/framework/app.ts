import { Layer } from './lib/layer'
import { createServer } from 'node:http'
import { Server, Socket } from 'socket.io'
import { router } from './router'
import { dic } from './dic'
import { createDIC } from './lib/di'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import koaBodyParser from '@koa/bodyparser'
import koaCORS from '@koa/cors'
import pf from 'portfinder'
import { Controller } from './controller'

interface AppSettingSchema {
    port?: number
    socketControllers?: Controller[]
    httpControllers?: (new (...rest: any[]) => any)[]
}

class ServerLayer extends Layer<ReturnType<typeof createServer>> {}
// class SocketLayer extends Layer<[...any[]]> {}
// class HttpLayer extends Layer<[...any[]]> {}
class EventLayer extends Layer<[...any[]]> {}

export class App<AppConfigType extends AppSettingSchema> {
    public appLayer: Layer<[AppConfigType]> = new Layer((_) => {
        /*empty*/
        this.serverLayer.go(createServer())
    })
    public serverLayer: ServerLayer = new ServerLayer(async (server) => {
        await Promise.race([
            pf.getPortPromise({
                port: this.setting.port,
            }),
            new Promise((r) => setTimeout(r, 3000)),
        ])
        server.listen(this.setting.port)
        console.debug(`server listened on ${JSON.stringify(server.address())}`)
    })
    public httpLayer: EventLayer = new EventLayer(() => {
        /*empty*/
    })
    public socketLayer: EventLayer = new EventLayer(() => {
        /*empty*/
    })
    public eventLayer: EventLayer = new EventLayer(() => {
        /*empty*/
    })

    constructor(public setting: AppConfigType) {
        // this.httpLayer

        // koa
        this.serverLayer.install(async (next, server) => {
            if (
                this.setting.httpControllers &&
                this.setting.httpControllers.length > 0
            ) {
                const app = new Koa()
                app.use(koaBodyParser())
                app.use(koaCORS())
                const koaRouter = new KoaRouter()
                // preload routes
                const { routes } = await router.getControllersRoutes(
                    this.setting.httpControllers || [],
                    dic,
                )
                Object.keys(routes).forEach((r) => {
                    koaRouter.all(r, async (ctx, next) => {
                        const { dic: newDIC } = createDIC(dic)
                        const params =
                            ctx.request.body instanceof Array
                                ? ctx.request.body
                                : []
                        newDIC.set('ctx', () => ctx)
                        await new EventLayer(
                            async (...rest: any[]) => {
                                if (routes[r] != null) {
                                    const c = await newDIC.makeImmediately(
                                        routes[r]!.Controller,
                                    )
                                    if (
                                        c &&
                                        c[routes[r]!.method] instanceof Function
                                    ) {
                                        ctx.body = await c[routes[r]!.method](
                                            ...rest,
                                        )
                                        return
                                    }
                                }
                                console.warn('404: ', r)
                            },
                            [
                                ...this.httpLayer.middlewares,
                                ...this.eventLayer.middlewares,
                            ],
                        ).go(...params)
                        await next()
                    })
                })
                app.use(koaRouter.routes())
                server.on('request', app.callback())
            }
            await next(server)
        })

        // socket.io
        this.serverLayer.install(async (next, server) => {
            if (
                this.setting.socketControllers?.length &&
                this.setting.socketControllers.length > 0
            ) {
                const io = new Server(server, {
                    cors: {
                        origin: '*',
                    },
                })
                // preload routes
                const { routes } = await router.getControllersRoutes(
                    this.setting.socketControllers,
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
                            const c = await newDIC.makeImmediately(
                                routeItem.Controller,
                            )
                            const handler = (...rest) =>
                                c[routeItem.method](...rest)
                            new EventLayer(
                                async (...rest: any) => {
                                    const ret: (...rest: any[]) => void =
                                        rest.slice(-1)[0]
                                    const params = rest.slice(
                                        0,
                                        rest.length - 1,
                                    )
                                    const returnDatas =
                                        (await handler?.(...params)) || []
                                    if (returnDatas instanceof Array) {
                                        ret(...returnDatas)
                                    } else {
                                        ret(returnDatas)
                                    }
                                },
                                [
                                    ...this.eventLayer.middlewares,
                                    ...this.socketLayer.middlewares,
                                ],
                            ).go(...rest)
                        } else {
                            console.debug('404: ', event)
                        }
                    })
                    return next(socket)
                })
                io.on('connect', async (socket) => {
                    await connectionLayer.go(socket)
                })
            }

            await next(server)
        })
    }

    async start() {
        return this.appLayer.go(this.setting)
    }
}
