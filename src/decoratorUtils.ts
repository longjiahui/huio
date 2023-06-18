import 'reflect-metadata'

const membersKey = Symbol.for('_membersKey')

export function getMembers(
    target: new (...rest: any[]) => any,
): (string | symbol)[] {
    return Reflect.getMetadata(membersKey, target) || []
}

export function MemberMetaDecorator(
    decorator: (
        target: object | (new (...rest: any[]) => any),
        key?: string | symbol,
    ) => any,
) {
    return (
        target: object | (new (...rest: any[]) => any),
        key?: string | symbol,
    ) => {
        if (
            !!key &&
            typeof target === 'object' &&
            !(target instanceof Function)
        ) {
            // object
            const members = getMembers(
                target.constructor as new (...rest: any[]) => any,
            )
            members.push(key)
            Reflect.defineMetadata(
                membersKey,
                [...new Set(members)],
                target.constructor,
            )
        }
        return decorator(target, key)
    }
}

export function getParamTypes(
    target: object | (new (...rest: any[]) => any),
    key?: string | symbol,
): (new (...rest: any[]) => any)[] {
    if (key) {
        return Reflect.getMetadata('design:paramtypes', target, key) || []
    } else {
        return Reflect.getMetadata('design:paramtypes', target) || []
    }
}
export function getType(
    target: object | (new (...rest: any[]) => any),
    key?: string | symbol,
): (new (...rest: any[]) => []) | undefined {
    if (key) {
        return Reflect.getMetadata('design:type', target, key)
    } else {
        return Reflect.getMetadata('design:type', target)
    }
}
