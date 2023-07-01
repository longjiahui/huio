import { Inject, createDIC } from '@/framework/lib/di'

describe('DIC', () => {
    test('DIC-@Provide-single', async () => {
        const { dic, Provide } = createDIC()
        @Provide(() => new B('b'))
        class B {
            constructor(public val: string) {}
        }
        @Provide(async (dic) => new A((await dic.make(B))?.val || ''))
        class A {
            constructor(public val: string) {}
        }
        return dic.make(A).then((a) => expect(a?.val).toBe('b'))
    })

    test('DIC-@Provide-multiple', async () => {
        const { dic, Provide } = createDIC()
        @Provide([
            {
                factory: () => new B('a'),
            },
            {
                key: 'Bb',
                factory: () => new B('b'),
            },
            {
                key: 'Bc',
                factory: () => new B('c'),
            },
        ])
        class B {
            constructor(public val: string) {}
        }
        @Provide([
            {
                factory: async (dic) =>
                    new InjectB((await dic.make(B))?.val || ''),
            },
            {
                key: 'injectBb',
                factory: async (dic) =>
                    new InjectB((await dic.make<typeof B>('Bb'))?.val || ''),
            },
            {
                key: 'injectBc',
                factory: async (dic) =>
                    new InjectB((await dic.make<typeof B>('Bc'))?.val || ''),
            },
        ])
        class InjectB {
            constructor(public val: string) {}
        }

        await dic.make(InjectB).then((val) => expect(val?.val).toBe('a'))
        await dic
            .make<typeof InjectB>('Bb')
            .then((val) => expect(val?.val).toBe('b'))
        await dic
            .make<typeof InjectB>('Bc')
            .then((val) => expect(val?.val).toBe('c'))
    })

    test('DIC-get-with-timeout', async () => {
        const { dic, Provide } = createDIC()

        class B {}

        expect(await dic.makeWithTimeout(B, -1)).toBe(undefined)
        const ret = dic
            .makeWithTimeout(B, 2000)
            .then((b) => expect(b).toBeInstanceOf(B))
        Provide(() => new B())(B)
        return ret
    })

    test('DIC-from', async () => {
        const { dic, Provide } = createDIC()
        @Provide(() => new A(1))
        class A {
            constructor(public a: number) {}
        }

        const { dic: newDIC } = createDIC(dic)
        expect((await newDIC.make(A))?.a).toBe(1)
    })
})

describe('Inject', () => {
    test('Inject', async () => {
        const { dic, Provide } = createDIC()
        @Provide(() => new A())
        class A {
            @Inject(() => 1)
            public hello!: number

            plus(@Inject.const(12) a: number, b: number) {
                return a + b
            }
        }
        await dic.make(A).then((a) => expect(a?.hello).toBe(1))
        await dic.make(A).then((a) => expect(a?.plus(1, 1)).toBe(13))

        @Provide(() => new B())
        class B {
            @Inject((dic) => dic.make(A))
            private a1!: A

            @Inject.key(A)
            public a2!: A

            getA() {
                return this.a1
            }
        }

        await dic.make(B).then((b) => expect(b?.getA().hello).toBe(1))
        await dic.make(B).then((b) => expect(b?.getA().plus(1, 1)).toBe(13))
        await dic.make(B).then((b) => expect(b?.a2.hello).toBe(1))
        await dic.make(B).then((b) => expect(b?.a2.plus(1, 1)).toBe(13))
    })
})
