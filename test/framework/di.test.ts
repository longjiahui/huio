import { DIC, Life, Provide } from '@/framework/lib/di'

describe('DIC', () => {
    test('DIC-provide', () => {
        const dic = new DIC()

        // provide string
        dic.provide('test', 123)
        expect(dic.get('test')).toBe(123)

        // provide symbol
        dic.provide(Symbol.for('test'), 123)
        expect(dic.get(Symbol.for('test'))).toBe(123)

        // provide constructor
        class A {
            constructor(public a: number = 0) {}
        }
        const a = new A(1)
        dic.provide(A, a)
        expect(dic.get(A)?.a).toBe(1)

        // override
        const b = new A(2)
        dic.provide(A, b)
        expect(dic.get(A)?.a).toBe(2)
    })

    test('DIC-@Provide-single', async () => {
        const aLife = new Life()
        @Provide({
            life: aLife,
            factory: () => new A(1),
        })
        class A {
            constructor(public a: number = 0) {}
        }
        const dic = new DIC()
        expect(dic.get(A)?.a).toBe(undefined)
        await aLife.emit('create')
        expect(dic.get(A)?.a).toBe(1)

        await aLife.emit('destroy')
        expect(dic.get(A)).toBe(undefined)
    })
})
