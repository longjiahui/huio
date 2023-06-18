import Emitter from '@/emitter'

describe('emitter', () => {
    test('emitter-on-and-emit', async () => {
        const emitter = new Emitter<{
            test: (a: number) => void
        }>()
        const testHandlerA = jest.fn(() => 3)
        emitter.on('test', testHandlerA)
        const testHandlerB = jest.fn(() => 4)
        emitter.on('test', testHandlerB)
        const emitterResolver = jest.fn()
        await emitter.emit('test', 1).then(emitterResolver)
        expect(testHandlerA).toHaveBeenCalledTimes(1)
        expect(testHandlerA).toBeCalledWith(1)
        expect(testHandlerB).toBeCalledTimes(1)
        expect(testHandlerB).toBeCalledWith(1)
        expect(emitterResolver).toBeCalledTimes(1)
        expect(emitterResolver).toBeCalledWith(expect.arrayContaining([3, 4]))
    })
    test('emitter-once-and-emit', async () => {
        const emitter = new Emitter<{
            test: (a: number) => void
        }>()
        const testHandlerA = jest.fn(() => 3)
        emitter.once('test', testHandlerA)
        const emitterResolver = jest.fn()
        await emitter.emit('test', 1).then(emitterResolver)
        await emitter.emit('test', 1).then(emitterResolver)
        expect(testHandlerA).toHaveBeenCalledTimes(1)
        expect(testHandlerA).toBeCalledWith(1)
        expect(emitterResolver).toBeCalledTimes(2)
        expect(emitterResolver).toHaveBeenNthCalledWith(
            1,
            expect.arrayContaining([3]),
        )

        expect(emitterResolver).toHaveBeenNthCalledWith(
            2,
            expect.arrayContaining([]),
        )
    })

    test('emitter-onAll', async () => {
        const emitter = new Emitter<{
            testA: (a: number) => void
            testB: (a: number) => void
        }>()

        const onAllHandler = jest.fn()
        emitter.onAll(onAllHandler)
        await emitter.emit('testA', 1)
        await emitter.emit('testB', 1)
        expect(onAllHandler).toBeCalledTimes(2)
        expect(onAllHandler).toHaveBeenNthCalledWith(1, 'testA', 1)
        expect(onAllHandler).toHaveBeenNthCalledWith(2, 'testB', 1)
    })

    test('emitter-onceAll', async () => {
        const emitter = new Emitter<{
            testA: (a: number) => void
            testB: (a: number) => void
        }>()

        const onceAllHandler = jest.fn()
        emitter.onceAll(onceAllHandler)
        await emitter.emit('testA', 1)
        await emitter.emit('testB', 1)
        expect(onceAllHandler).toBeCalledTimes(1)
        expect(onceAllHandler).toBeCalledWith('testA', 1)
    })
})
