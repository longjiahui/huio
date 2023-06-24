import 'reflect-metadata'

const membersKey = Symbol.for('_membersKey')

type AnyConstructor = new (...rest: any[]) => any

type MembersMap<T extends string | symbol = string | symbol> = Map<any, T[]>
type DecoratorType = (
    target: object | AnyConstructor,
    key?: string | symbol,
    index?: any,
) => any

export function getAllMembers(target: AnyConstructor): MembersMap {
    return Reflect.getMetadata(membersKey, target)
}

export function getMembers<T extends string | symbol>(
    target: AnyConstructor,
    mapKey: any,
) {
    return (
        (
            Reflect.getMetadata(membersKey, target) as MembersMap<T> | undefined
        )?.get(mapKey) || []
    )
}
export function setMembers(
    target: AnyConstructor,
    decorator: DecoratorType,
    members: (string | symbol)[],
) {
    let map = Reflect.getMetadata(membersKey, target) as MembersMap | undefined
    if (!map) {
        map = new Map() as MembersMap
    }
    map.set(decorator, members)
    return Reflect.defineMetadata(membersKey, map, target)
}

export function createMemberMetaDecorator(
    decorator: DecoratorType,
    mapKey?: any,
) {
    const finalDecorator = ((target, key, index) => {
        mapKey = mapKey || finalDecorator
        if (
            !!key &&
            typeof target === 'object' &&
            !(target instanceof Function)
        ) {
            // object
            let members = getMembers(
                target.constructor as AnyConstructor,
                mapKey,
            )
            members.push(key)
            // fianlDecorator 是包装好的decorator
            members = [...new Set(members)]
            // setMembers(target.constructor as AnyConstructor, decorator, members)
            setMembers(target.constructor as AnyConstructor, mapKey, members)
        }
        return decorator(target, key, index)
    }) as DecoratorType
    return finalDecorator
}

export function getParamTypes(
    target: object | AnyConstructor,
    key?: string | symbol,
): AnyConstructor[] {
    if (key) {
        return Reflect.getMetadata('design:paramtypes', target, key) || []
    } else {
        return Reflect.getMetadata('design:paramtypes', target) || []
    }
}
export function getType(
    target: object | AnyConstructor,
    key?: string | symbol,
): (new (...rest: any[]) => []) | undefined {
    if (key) {
        return Reflect.getMetadata('design:type', target, key)
    } else {
        return Reflect.getMetadata('design:type', target)
    }
}
