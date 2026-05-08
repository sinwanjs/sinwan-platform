import { describe, expect, it } from "bun:test";

import {
  DesignKeys,
  Reflector,
  SetMetadata,
  getParamTypes,
  installMetadataPatch,
  isMetadataPatched,
  reflector,
} from "../src/index";

describe("metadata patch", () => {
  it("installs the Reflect metadata APIs", () => {
    installMetadataPatch();
    expect(isMetadataPatched()).toBe(true);

    const R = Reflect as any;
    expect(typeof R.metadata).toBe("function");
    expect(typeof R.defineMetadata).toBe("function");
    expect(typeof R.getMetadata).toBe("function");
    expect(typeof R.getOwnMetadata).toBe("function");
    expect(typeof R.hasMetadata).toBe("function");
    expect(typeof R.hasOwnMetadata).toBe("function");
    expect(typeof R.getMetadataKeys).toBe("function");
    expect(typeof R.getOwnMetadataKeys).toBe("function");
    expect(typeof R.deleteMetadata).toBe("function");
  });

  it("reads inherited class metadata", () => {
    const R = Reflect as any;

    class Base {}
    class Child extends Base {}

    R.defineMetadata("role", "base", Base);

    expect(R.getMetadata("role", Child)).toBe("base");
    expect(R.getOwnMetadata("role", Child)).toBeUndefined();
    expect(R.hasMetadata("role", Child)).toBe(true);
    expect(R.hasOwnMetadata("role", Child)).toBe(false);
  });

  it("reads inherited property metadata and keys", () => {
    const R = Reflect as any;

    class Base {
      method() {
        return "base";
      }
    }

    class Child extends Base {
      override method() {
        return "child";
      }
    }

    R.defineMetadata("base-only", true, Base.prototype, "method");
    R.defineMetadata("child-only", true, Child.prototype, "method");

    expect(R.getMetadata("base-only", Child.prototype, "method")).toBe(true);
    expect(
      R.getOwnMetadata("base-only", Child.prototype, "method"),
    ).toBeUndefined();

    const keys = R.getMetadataKeys(Child.prototype, "method");
    const ownKeys = R.getOwnMetadataKeys(Child.prototype, "method");

    expect(keys).toEqual(expect.arrayContaining(["base-only", "child-only"]));
    expect(ownKeys).toEqual(expect.arrayContaining(["child-only"]));
  });

  it("reads design:paramtypes via helpers", () => {
    const R = Reflect as any;

    class Service {}
    class Controller {}

    R.defineMetadata(DesignKeys.paramTypes, [Service], Controller);

    expect(getParamTypes(Controller)).toEqual([Service]);
  });

  it("supports deleteMetadata", () => {
    const R = Reflect as any;

    class Target {}

    R.defineMetadata("to-delete", "value", Target);
    expect(R.hasMetadata("to-delete", Target)).toBe(true);
    expect(R.getMetadata("to-delete", Target)).toBe("value");

    const result = R.deleteMetadata("to-delete", Target);
    expect(result).toBe(true);
    expect(R.hasMetadata("to-delete", Target)).toBe(false);
    expect(R.getMetadata("to-delete", Target)).toBeUndefined();

    // Deleting non-existent key returns false
    expect(R.deleteMetadata("non-existent", Target)).toBe(false);
  });

  it("handles deep prototype chains (3+ levels)", () => {
    const R = Reflect as any;

    class A {}
    class B extends A {}
    class C extends B {}
    class D extends C {}

    R.defineMetadata("deep", "from-A", A);

    expect(R.getMetadata("deep", D)).toBe("from-A");
    expect(R.hasMetadata("deep", D)).toBe(true);
    expect(R.getOwnMetadata("deep", D)).toBeUndefined();
    expect(R.hasOwnMetadata("deep", D)).toBe(false);
  });

  it("rejects non-object targets with TypeError", () => {
    const R = Reflect as any;

    expect(() => R.defineMetadata("key", "val", null)).toThrow(TypeError);
    expect(() => R.defineMetadata("key", "val", undefined)).toThrow(TypeError);
    expect(() => R.defineMetadata("key", "val", 42)).toThrow(TypeError);
    expect(() => R.defineMetadata("key", "val", "string")).toThrow(TypeError);
  });
});

describe("reflector", () => {
  it("supports typed and string keyed decorators", () => {
    const Roles = Reflector.createDecorator<string[]>();
    const Tags = (...tags: string[]) => SetMetadata("tags", tags);

    class Demo {
      run() {
        return "ok";
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(Demo.prototype, "run");
    if (!descriptor) throw new Error("missing descriptor");

    Roles(["admin"])(Demo.prototype, "run", descriptor);
    Roles(["user"])(Demo);
    Tags("alpha", "beta")(Demo);

    expect(
      reflector.getFromMethod(Roles, Demo.prototype, "run") ?? ([] as string[]),
    ).toEqual(["admin"]);
    expect(reflector.get(Roles, Demo) ?? ([] as string[])).toEqual(["user"]);
    expect(reflector.get("tags", Demo) ?? ([] as string[])).toEqual([
      "alpha",
      "beta",
    ]);

    const merged = reflector.getAllAndMerge(Roles, [descriptor.value!, Demo]);
    expect(new Set(merged)).toEqual(new Set(["admin", "user"]));
  });

  it("getAllAndOverride returns the first defined value", () => {
    const Priority = Reflector.createDecorator<number>();

    class A {}
    class B {}
    class C {}

    Priority(10)(A);
    Priority(20)(C);
    // B has no metadata

    // A is first, should return A's value
    expect(reflector.getAllAndOverride(Priority, [A, B, C])).toBe(10);

    // B is first but has no metadata, should skip to C
    expect(reflector.getAllAndOverride(Priority, [B, C])).toBe(20);
  });

  it("getAllAndOverride returns undefined for empty targets", () => {
    const Empty = Reflector.createDecorator<string>();

    expect(reflector.getAllAndOverride(Empty, [])).toBeUndefined();
  });

  it("getAll returns array of results for each target", () => {
    const Label = Reflector.createDecorator<string>();

    class X {}
    class Y {}
    class Z {}

    Label("x")(X);
    Label("y")(Y);
    // Z has no metadata

    const results = reflector.getAll(Label, [X, Y, Z]);
    expect(results).toHaveLength(3);
    expect(results[0]).toBe("x");
    expect(results[1]).toBe("y");
    expect(results[2]).toBeUndefined();
  });

  it("getFromMethod returns undefined for missing method metadata", () => {
    const Action = Reflector.createDecorator<string>();

    class NoMeta {
      doStuff() {}
    }

    const result = reflector.getFromMethod(Action, NoMeta.prototype, "doStuff");
    expect(result).toBeUndefined();
  });

  it("getFromMethod works with string keys", () => {
    class Target {
      handler() {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      "handler",
    );
    if (!descriptor) throw new Error("missing descriptor");

    SetMetadata("action", "handle")(Target.prototype, "handler", descriptor);

    const result = reflector.getFromMethod<string>(
      "action",
      Target.prototype,
      "handler",
    );
    expect(result).toBe("handle");
  });

  it("SetMetadata handles null and undefined values", () => {
    class NullTarget {}
    class UndefinedTarget {}

    // null becomes {} due to the ?? {} fallback
    SetMetadata("key", null)(NullTarget);
    expect(reflector.get<object>("key", NullTarget)).toEqual({});

    // undefined becomes {} due to the ?? {} fallback
    SetMetadata("key", undefined)(UndefinedTarget);
    expect(reflector.get<object>("key", UndefinedTarget)).toEqual({});
  });

  it("has returns true for existing metadata", () => {
    const Flag = Reflector.createDecorator<boolean>();

    class HasTarget {}

    Flag(true)(HasTarget);

    expect(reflector.has(Flag, HasTarget)).toBe(true);
  });

  it("has returns false for missing metadata", () => {
    const Missing = Reflector.createDecorator<boolean>();

    class NoTarget {}

    expect(reflector.has(Missing, NoTarget)).toBe(false);
  });

  it("getAllAndMerge returns empty array for no metadata", () => {
    const Empty = Reflector.createDecorator<string[]>();

    class NoMeta1 {}
    class NoMeta2 {}

    const result = reflector.getAllAndMerge(Empty, [NoMeta1, NoMeta2]);
    expect(result).toEqual([]);
  });

  it("getAllAndMerge merges objects via spread", () => {
    const Config = Reflector.createDecorator<Record<string, any>>();

    class A {}
    class B {}
    

    Config({ host: "localhost" })(A);
    Config({ port: 3000 })(B);

    const merged = reflector.getAllAndMerge(Config, [A, B]);
    expect(merged).toEqual({ host: "localhost", port: 3000 });
  });

  it("createDecorator with custom key uses that key", () => {
    const Custom = Reflector.createDecorator<string>({ key: "my-custom-key" });

    expect(Custom.KEY).toBe("my-custom-key");

    class Target {}
    Custom("value")(Target);

    expect(reflector.get<string>("my-custom-key", Target)).toBe("value");
    expect(reflector.get(Custom, Target)).toBe("value");
  });

  it("createDecorator with transform applies transformation", () => {
    const Upper = Reflector.createDecorator<string, string>({
      transform: (val: string) => val.toUpperCase(),
    });

    class Target {}
    Upper("hello")(Target);

    expect(reflector.get(Upper, Target)).toBe("HELLO");
  });
});
