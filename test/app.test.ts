import { App } from '@/app'
import { Route } from '@/controller/controller'

@Route('/user')
export class UserController {
    @Route('/get')
    async get(msg: string) {
        console.debug('hello?', msg)
        await new Promise((r) => setTimeout(r, 2000))
        return [{ hello: msg }]
    }
}

new App({
    port: 3000,
}).start()
