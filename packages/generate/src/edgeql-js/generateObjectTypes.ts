import { CodeFragment, dts, r, t, ts } from "../builders";
import type { GeneratorParams } from "../genutil";
import type { $ } from "../genutil";
import {
  frag,
  getRef,
  joinFrags,
  // makePlainIdent,
  quote,
  splitName,
  // toTSScalarType
} from "../genutil";

const singletonObjectTypes = new Set(["std::FreeObject"]);

export const getStringRepresentation: (
  type: $.introspect.Type,
  params: {
    types: $.introspect.Types;
    anytype?: string | CodeFragment[];
    casts?: { [key: string]: string[] };
    castSuffix?: string;
  }
) => { staticType: CodeFragment[]; runtimeType: CodeFragment[] } = (
  type,
  params
) => {
  const suffix = params.castSuffix || `λICastableTo`;
  if (type.name === "anytype") {
    return {
      staticType: frag`${params.anytype ?? `$.BaseType`}`,
      runtimeType: [],
    };
  }
  if (type.name === "anytuple") {
    return {
      staticType: [`$.AnyTupleType`],
      runtimeType: [],
    };
  }
  if (type.name === "std::anypoint") {
    return {
      staticType: frag`${params.anytype ?? getRef("std::anypoint")}`,
      runtimeType: [],
    };
  }
  if (type.name === "std::anyenum") {
    return {
      staticType: [`$.EnumType`],
      runtimeType: [],
    };
  }
  const { types, casts } = params;
  if (type.kind === "object") {
    if (type.name === "std::BaseObject") {
      return {
        staticType: ["$.ObjectType"],
        runtimeType: [getRef(type.name)],
      };
    }
    if (type.union_of?.length) {
      const items = type.union_of.map((it) =>
        getStringRepresentation(types.get(it.id), params)
      );
      return {
        staticType: joinFrags(
          items.map((it) => it.staticType),
          " | "
        ),
        runtimeType: joinFrags(
          items.map((it) => it.runtimeType),
          " | "
        ),
      };
    }
    return {
      staticType: [getRef(type.name)],
      runtimeType: [getRef(type.name)],
    };
  } else if (type.kind === "scalar") {
    return {
      staticType: [getRef(type.name), casts?.[type.id]?.length ? suffix : ""],
      runtimeType: [getRef(type.name)],
    };
    // const tsType = toJsScalarType(target, types, mod, body);
  } else if (type.kind === "array") {
    return {
      staticType: frag`$.ArrayType<${
        getStringRepresentation(types.get(type.array_element_id), params)
          .staticType
      }>`,
      runtimeType: frag`$.ArrayType(${
        getStringRepresentation(types.get(type.array_element_id), params)
          .runtimeType
      })`,
    };
  } else if (type.kind === "tuple") {
    const isNamed = type.tuple_elements[0].name !== "0";
    if (isNamed) {
      const itemsStatic = joinFrags(
        type.tuple_elements.map(
          (it) =>
            frag`${it.name}: ${
              getStringRepresentation(types.get(it.target_id), params)
                .staticType
            }`
        ),
        ", "
      );
      const itemsRuntime = joinFrags(
        type.tuple_elements.map(
          (it) =>
            frag`${it.name}: ${
              getStringRepresentation(types.get(it.target_id), params)
                .runtimeType
            }`
        ),
        ", "
      );

      return {
        staticType: frag`$.NamedTupleType<{${itemsStatic}}>`,
        runtimeType: frag`$.NamedTupleType({${itemsRuntime}})`,
      };
    } else {
      const items = type.tuple_elements
        .map((it) => it.target_id)
        .map((id) => types.get(id))
        .map((el) => getStringRepresentation(el, params));

      return {
        staticType: frag`$.TupleType<[${joinFrags(
          items.map((it) => it.staticType),
          ", "
        )}]>`,
        runtimeType: frag`$.TupleType([${joinFrags(
          items.map((it) => it.runtimeType),
          ", "
        )}])`,
      };
    }
  } else if (type.kind === "range") {
    return {
      staticType: frag`$.RangeType<${
        getStringRepresentation(types.get(type.range_element_id), params)
          .staticType
      }>`,
      runtimeType: frag`$.RangeType(${
        getStringRepresentation(types.get(type.range_element_id), params)
          .runtimeType
      })`,
    };
  } else {
    throw new Error("Invalid type");
  }
};

export const generateObjectTypes = (params: GeneratorParams) => {
  const { dir, types } = params;

  // const plainTypesCode = dir.getPath("types");
  // plainTypesCode.addImportStar("edgedb", "edgedb", {
  //   typeOnly: true
  // });
  // const plainTypeModules = new Map<
  //   string,
  //   {internalName: string; buf: CodeBuffer; types: Map<string, string>}
  // >();

  // const getPlainTypeModule = (
  //   typeName: string
  // ): {
  //   tMod: string;
  //   tName: string;
  //   module: {
  //     internalName: string;
  //     buf: CodeBuffer;
  //     types: Map<string, string>;
  //   };
  // } => {
  //   const {mod: tMod, name: tName} = splitName(typeName);
  //   if (!plainTypeModules.has(tMod)) {
  //     plainTypeModules.set(tMod, {
  //       internalName: makePlainIdent(tMod),
  //       buf: new CodeBuffer(),
  //       types: new Map()
  //     });
  //   }
  //   return {tMod, tName, module: plainTypeModules.get(tMod)!};
  // };

  // const _getTypeName =
  //   (mod: string) =>
  //   (typeName: string, withModule: boolean = false): string => {
  //     const {tMod, tName, module} = getPlainTypeModule(typeName);
  //     return (
  //       ((mod !== tMod || withModule) && tMod !== "default"
  //         ? `${module.internalName}.`
  //         : "") + `${makePlainIdent(tName)}`
  //     );
  //   };

  for (const type of types.values()) {
    if (type.kind !== "object") {
      // if (type.kind === "scalar" && type.enum_values?.length) {
      //   // generate plain enum type
      //   const {mod: enumMod, name: enumName} = splitName(type.name);
      //   const getEnumTypeName = _getTypeName(enumMod);

      //   const {module} = getPlainTypeModule(type.name);
      //   module.types.set(enumName, getEnumTypeName(type.name, true));
      //   module.buf.writeln(
      //     [t`export enum ${getEnumTypeName(type.name)} {`],
      //     ...type.enum_values.map(val => [
      //       t`  ${makePlainIdent(val)} = ${quote(val)},`
      //     ]),
      //     [t`}`]
      //   );

      //   if (enumMod === "default") {
      //     module.buf.writeln(
      //       [js`const ${getEnumTypeName(type.name)} = {`],
      //       ...type.enum_values.map(val => [
      //         js`  ${makePlainIdent(val)}: ${quote(val)},`
      //       ]),
      //       [js`}`]
      //     );
      //     plainTypesCode.addExport(getEnumTypeName(type.name), {
      //       modes: ["js"]
      //     });
      //   } else {
      //     module.buf.writeln(
      //       [js`"${getEnumTypeName(type.name)}": {`],
      //       ...type.enum_values.map(val => [
      //         js`  ${makePlainIdent(val)}: ${quote(val)},`
      //       ]),
      //       [js`},`]
      //     );
      //   }
      // }
      continue;
    }

    const isUnionType = Boolean(type.union_of?.length);
    const isIntersectionType = Boolean(type.intersection_of?.length);

    if (isIntersectionType) {
      continue;
    }

    const { mod, name } = splitName(type.name);

    const body = dir.getModule(mod);

    body.registerRef(type.name, type.id);

    const ref = getRef(type.name);

    /////////
    // generate plain type
    /////////

    // const getTypeName = _getTypeName(mod);

    // const getTSType = (pointer: $.introspect.Pointer): string => {
    //   const targetType = types.get(pointer.target_id);
    //   if (pointer.kind === "link") {
    //     return getTypeName(targetType.name);
    //   } else {
    //     return toTSScalarType(
    //       targetType as $.introspect.PrimitiveType,
    //       types,
    //       {
    //         getEnumRef: enumType => getTypeName(enumType.name),
    //         edgedbDatatypePrefix: ""
    //       }
    //     ).join("");
    //   }
    // };

    // const {module: plainTypeModule} = getPlainTypeModule(type.name);

    // if (!isUnionType) {
    //   plainTypeModule.types.set(name, getTypeName(type.name, true));
    // }
    // plainTypeModule.buf.writeln([
    //   t`${
    //    !isUnionType ? "export " : ""
    //   }interface ${getTypeName(type.name)}${
    //     type.bases.length
    //       ? ` extends ${type.bases
    //           .map(({id}) => {
    //             const baseType = types.get(id);
    //             return getTypeName(baseType.name);
    //           })
    //           .join(", ")}`
    //       : ""
    //   } ${
    //     type.pointers.length
    //       ? `{\n${type.pointers
    //           .map(pointer => {
    //             const isOptional =
    //               pointer.real_cardinality === Cardinality.AtMostOne;
    //             return `  ${quote(pointer.name)}${
    //               isOptional ? "?" : ""
    //             }: ${getTSType(pointer)}${
    //               pointer.card === Cardinality.Many ||
    //               pointer.card === Cardinality.AtLeastOne
    //                 ? "[]"
    //                 : ""
    //             }${isOptional ? " | null" : ""};`;
    //           })
    //           .join("\n")}\n}`
    //       : "{}"
    //   }\n`,
    // ]);

    /////////
    // generate interface
    /////////

    type Line = {
      card: string;
      staticType: CodeFragment[];
      runtimeType: CodeFragment[];
      key: string;
      isExclusive: boolean;
      is_computed: boolean;
      is_readonly: boolean;
      hasDefault: boolean;
      kind: "link" | "property";
      lines: Line[];
    };

    const ptrToLine: (
      ptr: $.introspect.Pointer | $.introspect.Backlink
    ) => Line = (ptr) => {
      const card = `$.Cardinality.${ptr.card}`;
      const target = types.get(ptr.target_id);
      const { staticType, runtimeType } = getStringRepresentation(target, {
        types,
      });

      return {
        key: ptr.name,
        staticType,
        runtimeType,
        card,
        kind: ptr.kind,
        isExclusive: ptr.is_exclusive,
        is_computed: ptr.is_computed ?? false,
        is_readonly: ptr.is_readonly ?? false,
        hasDefault: ptr.has_default ?? false,
        lines: (ptr.pointers ?? [])
          .filter((p) => p.name !== "@target" && p.name !== "@source")
          .map(ptrToLine),
      };
    };

    // unique
    // const BaseObject = params.typesByName["std::BaseObject"];
    // const uniqueStubs = [...new Set(type.backlinks.map((bl) => bl.stub))];
    // const stubLines = uniqueStubs.map((stub): $.introspect.Pointer => {
    //   return {
    //     card: Cardinality.Many,
    //     kind: "link",
    //     name: `<${stub}`,
    //     target_id: BaseObject.id,
    //     is_exclusive: false,
    //     pointers: null,
    //   };
    // });
    const lines = [
      ...type.pointers,
      ...type.backlinks,
      ...type.backlink_stubs,
    ].map(ptrToLine);

    // generate shape type
    const fieldNames = new Set(lines.map((l) => l.key));
    const baseTypesUnion = type.bases.length
      ? frag`${joinFrags(
          type.bases.map((base) => {
            const baseType = types.get(base.id) as $.introspect.ObjectType;
            const overloadedFields = [
              ...baseType.pointers,
              ...baseType.backlinks,
              ...baseType.backlink_stubs,
            ]
              .filter((field) => fieldNames.has(field.name))
              .map((field) => quote(field.name));
            const baseRef = getRef(baseType.name);
            return overloadedFields.length
              ? frag`Omit<${baseRef}λShape, ${overloadedFields.join(" | ")}>`
              : frag`${baseRef}λShape`;
          }),
          " & "
        )} & `
      : ``;
    body.writeln([
      t`export `,
      dts`declare `,
      t`type ${ref}λShape = $.typeutil.flatten<${baseTypesUnion}{`,
    ]);
    body.indented(() => {
      for (const line of lines) {
        if (line.kind === "link") {
          if (!line.lines.length) {
            body.writeln([
              t`${quote(line.key)}: $.LinkDesc<${line.staticType}, ${
                line.card
              }, {}, ${line.isExclusive.toString()}, ${line.is_computed.toString()},  ${line.is_readonly.toString()}, ${line.hasDefault.toString()}>;`,
            ]);
          } else {
            body.writeln([
              t`${quote(line.key)}: $.LinkDesc<${line.staticType}, ${
                line.card
              }, {`,
            ]);
            body.indented(() => {
              for (const linkProp of line.lines) {
                body.writeln([
                  t`${quote(linkProp.key)}: $.PropertyDesc<${
                    linkProp.staticType
                  }, ${linkProp.card}>;`,
                ]);
              }
            });
            body.writeln([
              t`}, ${line.isExclusive.toString()}, ${line.is_computed.toString()}, ${line.is_readonly.toString()}, ${line.hasDefault.toString()}>;`,
            ]);
          }
        } else {
          body.writeln([
            t`${quote(line.key)}: $.PropertyDesc<${line.staticType}, ${
              line.card
            }, ${line.isExclusive.toString()}, ${line.is_computed.toString()}, ${line.is_readonly.toString()}, ${line.hasDefault.toString()}>;`,
          ]);
        }
      }
    });
    body.writeln([t`}>;`]);

    // instantiate ObjectType subtype from shape
    body.writeln([
      dts`declare `,
      t`type ${ref} = $.ObjectType<${quote(type.name)}, ${ref}λShape, null, [`,
    ]);

    const bases = type.bases
      .map((b) => types.get(b.id))
      .map((b) => getRef(b.name));
    body.indented(() => {
      for (const b of bases) {
        body.writeln([t`...${b}['__exclusives__'],`]);
      }
    });

    // const ref = getRef(type.name);
    for (const ex of type.exclusives) {
      body.writeln([
        t`  {`,
        ...Object.keys(ex).map((key) => {
          const target = types.get(ex[key].target_id);
          const { staticType } = getStringRepresentation(target, { types });
          const card = `$.Cardinality.One | $.Cardinality.AtMostOne `;
          return t`${key}: {__element__: ${staticType}, __cardinality__: ${card}},`;
        }),
        t`},`,
      ]);
      // body.writeln([t`\n  {${lines.join(", ")}}`]);
    }

    body.writeln([t`]>;`]);

    if (type.name === "std::Object") {
      body.writeln([t`export `, dts`declare `, t`type $Object = ${ref}`]);
    }

    /////////
    // generate runtime type
    /////////
    if (isUnionType) {
      // union types don't need runtime type
      continue;
    }

    const literal = getRef(type.name, { prefix: "" });

    body.writeln([
      dts`declare `,
      ...frag`const ${ref}`,
      dts`: ${ref}`,
      r` = $.makeType`,
      ts`<${ref}>`,
      r`(_.spec, ${quote(type.id)}, _.syntax.literal);`,
    ]);
    body.addExport(ref);
    // body.addExport(ref, `$${name}`); // dollar

    const typeCard = singletonObjectTypes.has(type.name) ? "One" : "Many";

    body.nl();
    body.writeln([
      dts`declare `,
      ...frag`const ${literal}`,
      // tslint:disable-next-line
      t`: $.$expr_PathNode<$.TypeSet<${ref}, $.Cardinality.${typeCard}>, null> `,
      r`= _.syntax.$PathNode($.$toSet(${ref}, $.Cardinality.${typeCard}), null);`,
    ]);
    body.nl();

    body.addExport(literal);
    body.addToDefaultExport(literal, name);
  }

  // plain types export
  // const plainTypesExportBuf = new CodeBuffer();
  // for (const [moduleName, module] of plainTypeModules) {
  //   if (moduleName === "default") {
  //     plainTypesCode.writeBuf(module.buf);
  //   } else {
  //  plainTypesCode.writeln([t`export namespace ${module.internalName} {`]);
  //     plainTypesCode.writeln([js`const ${module.internalName} = {`]);
  //     plainTypesCode.indented(() => plainTypesCode.writeBuf(module.buf));
  //     plainTypesCode.writeln([t`}`]);
  //     plainTypesCode.writeln([js`}`]);
  //     plainTypesCode.addExport(module.internalName, {modes: ["js"]});
  //   }

  //   plainTypesExportBuf.writeln([
  //     t`  ${quote(moduleName)}: {\n${[...module.types.entries()]
  //       .map(([name, typeName]) => `    ${quote(name)}: ${typeName};`)
  //       .join("\n")}\n  };`
  //   ]);
  // }
  // plainTypesCode.writeln([t`export interface types {`]);
  // plainTypesCode.writeBuf(plainTypesExportBuf);
  // plainTypesCode.writeln([t`}`]);
};
