import ts from "typescript";

const configPath = ts.findConfigFile(
  process.cwd(),
  ts.sys.fileExists,
  "tsconfig.json",
);
if (!configPath) throw new Error("tsconfig.json was not found");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
  );
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  process.cwd(),
);
const program = ts.createProgram(parsed.fileNames, {
  ...parsed.options,
  noEmit: true,
});
const checker = program.getTypeChecker();
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
const forbidden: string[] = [];
for (const source of program.getSourceFiles()) {
  if (source.isDeclarationFile || source.fileName.includes("node_modules"))
    continue;
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const position = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      forbidden.push(
        `${source.fileName}:${position.line + 1}: explicit unrestricted type is forbidden`,
      );
    }
    if (
      (ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name)
    ) {
      const type = checker.getTypeAtLocation(node.name);
      const elementType = checker.isArrayType(type)
        ? checker.getIndexTypeOfType(type, ts.IndexKind.Number)
        : undefined;
      const elementTypes = elementType ? [elementType] : [];
      if (
        [type, ...elementTypes].some(
          (candidate) => candidate.flags & ts.TypeFlags.Any,
        )
      ) {
        const position = source.getLineAndCharacterOfPosition(
          node.getStart(source),
        );
        forbidden.push(
          `${source.fileName}:${position.line + 1}: ${node.name.text} must have a safe type`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (/@ts-(?:ignore|nocheck|expect-error)/.test(source.text))
    forbidden.push(
      `${source.fileName}: TypeScript suppression comments are forbidden`,
    );
}
if (diagnostics.length)
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => "\n",
    }),
  );
for (const message of forbidden) console.error(message);
if (diagnostics.length || forbidden.length) process.exitCode = 1;
else console.log("Strict TypeScript and source type-safety checks passed.");
