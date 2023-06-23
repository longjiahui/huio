import { Layer } from '@/framework/lib/layer'

describe('Layer', () => {
    test('Layer-constructor', async () => {
        const layer = new Layer<number, string>((val) => val.toString())
        return layer.go(12).then((val) => expect(val).toBe('12'))
    })

    test('Layer-install/uninstall-middleware', async () => {
        const layer = new Layer<number, string>((val) => {
            return val.toString()
        })
        const middleware = jest.fn((next, param) => {
            return next(++param)
        })
        layer.install(middleware)
        await layer.go(12).then((val) => expect(val).toBe('13'))
        expect(middleware).toBeCalledTimes(1)
        layer.uninstall(middleware)
        await layer.go(12).then((val) => expect(val).toBe('12'))
        expect(middleware).toBeCalledTimes(1)
    })
})
