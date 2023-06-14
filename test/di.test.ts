import { DI, DIC, Inject, getInjectable, injectableKey } from '@/di'
import 'reflect-metadata'

// describe('DI Demo', () => {
//     test('default', () => {
//         const dic = new DIC()
//     })
// })

describe('DI Decorator', () => {
    test('default', () => {
        @DI()
        class A {}
        expect(getInjectable(A)).toBe(true)
    })
})

describe('DIC-Provide/getByToken', () => {
    test('provide function', () => {
        const center = new DIC()
        center.provide('test', () => 'test')
        center.get('test').then((d) => expect(d).toBe('test'))
    })

    test('provide value', () => {
        const center = new DIC()
        center.provide('test', 'hello world')
        center.get('test').then((d) => expect(d).toBe('hello world'))
    })

    test('provide async function', () => {
        const center = new DIC()
        center.provide('test', async () => 'hello world')
        center.get('test').then((d) => expect(d).toBe('hello world'))
    })
})
describe('DIC-getByTarget', () => {
    test('inject into constructor', () => {
        @DI()
        class C {
            constructor(public a: number) {}
        }

        @DI()
        class B {
            constructor(public c: C) {}
        }

        @DI()
        class A {
            constructor(public a: number, public b: string, public c: B) {}
        }

        new DIC().get(A).then((a) => {
            expect(typeof a.a).toBe('number')
            expect(typeof a.b).toBe('string')
            expect(a.c).toBeInstanceOf(B)
            expect(a.c.c).toBeInstanceOf(C)
            expect(typeof a.c.c.a).toBe('number')
        })
    })

    test('inject into method parameters', () => {
        class C {
            public a = 12
        }
        class A {
            @DI()
            test(a: number, b: string, c: C) {
                return a + b + 'hello world'
            }
        }

        const dic = new DIC()
        dic.get(A).then((a) => {
            expect(a.test.call(undefined)).toBe('0hello world')
        })
    })

    test('inject into properties', () => {
        @DI()
        class B {
            constructor(public a: number) {}
        }
        class A {
            @DI()
            public test: B
        }
        new DIC().get(A).then((a) => {
            expect(a.test).toBeInstanceOf(B)
            expect(typeof a.test.a).toBe('number')
            expect(a.test.a).toBe(0)
        })
    })

    test('inject with custom params', () => {
        class A {
            constructor(public a: number, public b: number) {}
        }
        new DIC().get(A, 13, 14).then((d) => {
            expect(d.a).toBe(13)
            expect(d.b).toBe(14)
        })
    })
})

describe('DIC-InjectDecorator', () => {
    test('inject constructor and inject a factory', () => {
        @DI()
        class A {
            constructor(@Inject<number>(() => 32) public a: number) {}
        }
        new DIC().get(A).then((a) => expect(a.a).toBe(32))
    })

    test('inject token', () => {
        const dic = new DIC()
        dic.provide('test', 123)
        @DI()
        class A {
            constructor(@Inject.Token('test') public a: number) {}
        }
        dic.get(A).then((a) => expect(a.a).toBe(123))
    })

    test('inject factory token', () => {
        const dic = new DIC()
        dic.provide('test', () => 123)
        @DI()
        class A {
            constructor(@Inject.Token('test') public a: number) {}
        }
        dic.get(A).then((a) => expect(a.a).toBe(123))
    })

    test('inject const', () => {
        const dic = new DIC()
        @DI()
        class A {
            constructor(b: number, @Inject.Const(123) public a: number) {}
        }
        dic.get(A).then((a) => expect(a.a).toBe(123))
    })
})
