#!/usr/bin/env python3
"""
Parse Python files using the built-in ast module and output a
JSON KnowledgeGraph fragment to stdout.

Input  (stdin): JSON object with a "files" key containing an array of
                {"absolutePath": str, "relativePath": str}

Output (stdout): JSON object with "nodes" and "edges" conforming to the
                 KnowledgeGraph shape used by the worker.
"""

import ast
import json
import sys
import traceback


def extract_file_info(file_path: str, rel_path: str) -> dict | None:
    """Parse a single .py file and return its node/edge data, or None on error."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            source = f.read()
    except Exception:
        return None

    try:
        tree = ast.parse(source, filename=file_path)
    except SyntaxError:
        return None

    nodes: list[dict] = []
    edges: list[dict] = []
    exported_names: list[str] = []

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            cls_id = f"{rel_path}::class::{node.name}"
            methods = []
            properties = []
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    methods.append({
                        "name": item.name,
                        "isStatic": _is_static(item),
                        "isAsync": isinstance(item, ast.AsyncFunctionDef),
                        "decorators": [d.id for d in item.decorator_list if isinstance(d, ast.Name)],
                    })
                elif isinstance(item, ast.Assign):
                    for target in item.targets:
                        if isinstance(target, ast.Name):
                            properties.append({"name": target.id})
                elif isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    properties.append({"name": item.target.id})

            decorators = [
                d.id for d in node.decorator_list if isinstance(d, ast.Name)
            ]

            bases = []
            for base in node.bases:
                if isinstance(base, ast.Name):
                    bases.append(base.id)
                elif isinstance(base, ast.Attribute):
                    bases.append(f"{_attr_name(base)}")

            nodes.append({
                "id": cls_id,
                "type": "class",
                "name": node.name,
                "filePath": rel_path,
                "layer": "unknown",
                "metadata": {
                    "methods": methods,
                    "properties": properties,
                    "decorators": decorators,
                    "bases": bases,
                },
            })
            edges.append({
                "source": rel_path,
                "target": cls_id,
                "type": "contains",
            })
            exported_names.append(node.name)

            for base_name in bases:
                edges.append({
                    "source": cls_id,
                    "target": base_name,
                    "type": "extends",
                })

        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            fn_id = f"{rel_path}::function::{node.name}"
            params = []
            for arg in node.args.args:
                annotation = ""
                if arg.annotation:
                    if isinstance(arg.annotation, ast.Name):
                        annotation = arg.annotation.id
                    elif isinstance(arg.annotation, ast.Subscript):
                        annotation = _subscript_name(arg.annotation)
                    elif isinstance(arg.annotation, ast.Attribute):
                        annotation = _attr_name(arg.annotation)
                params.append({
                    "name": arg.arg,
                    "annotation": annotation,
                })

            return_annotation = ""
            if node.returns:
                if isinstance(node.returns, ast.Name):
                    return_annotation = node.returns.id
                elif isinstance(node.returns, ast.Subscript):
                    return_annotation = _subscript_name(node.returns)
                elif isinstance(node.returns, ast.Attribute):
                    return_annotation = _attr_name(node.returns)

            decorators = [
                d.id for d in node.decorator_list if isinstance(d, ast.Name)
            ]

            nodes.append({
                "id": fn_id,
                "type": "function",
                "name": node.name,
                "filePath": rel_path,
                "layer": "unknown",
                "metadata": {
                    "isAsync": isinstance(node, ast.AsyncFunctionDef),
                    "params": params,
                    "returnType": return_annotation,
                    "decorators": decorators,
                },
            })
            edges.append({
                "source": rel_path,
                "target": fn_id,
                "type": "contains",
            })
            exported_names.append(node.name)

        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    var_id = f"{rel_path}::variable::{target.id}"
                    nodes.append({
                        "id": var_id,
                        "type": "variable",
                        "name": target.id,
                        "filePath": rel_path,
                        "layer": "unknown",
                        "metadata": {},
                    })
                    edges.append({
                        "source": rel_path,
                        "target": var_id,
                        "type": "contains",
                    })
                    exported_names.append(target.id)

        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            var_id = f"{rel_path}::variable::{node.target.id}"
            annotation = ""
            if node.annotation:
                if isinstance(node.annotation, ast.Name):
                    annotation = node.annotation.id
                elif isinstance(node.annotation, ast.Subscript):
                    annotation = _subscript_name(node.annotation)
                elif isinstance(node.annotation, ast.Attribute):
                    annotation = _attr_name(node.annotation)
            nodes.append({
                "id": var_id,
                "type": "variable",
                "name": node.target.id,
                "filePath": rel_path,
                "layer": "unknown",
                "metadata": {"annotation": annotation},
            })
            edges.append({
                "source": rel_path,
                "target": var_id,
                "type": "contains",
            })
            exported_names.append(node.target.id)

    imports: list[dict] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append({
                    "source": rel_path,
                    "module": alias.name,
                    "names": [alias.asname or alias.name],
                })
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            names = [alias.asname or alias.name for alias in node.names]
            imports.append({
                "source": rel_path,
                "module": module,
                "names": names,
            })

    summary_parts = []
    classes = [n for n in nodes if n["type"] == "class"]
    if classes:
        summary_parts.append(f"Classes: {', '.join(c['name'] for c in classes)}")
    functions = [n for n in nodes if n["type"] == "function"]
    if functions:
        summary_parts.append(f"Functions: {', '.join(f['name'] for f in functions)}")
    variables = [n for n in nodes if n["type"] == "variable"]
    if variables:
        summary_parts.append(f"Variables: {', '.join(v['name'] for v in variables)}")

    return {
        "nodes": nodes,
        "edges": edges,
        "imports": imports,
        "summary": " | ".join(summary_parts) or "No exports",
    }


def _is_static(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    for decorator in node.decorator_list:
        if isinstance(decorator, ast.Name) and decorator.id == "staticmethod":
            return True
    return False


def _attr_name(node: ast.Attribute) -> str:
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    return ".".join(reversed(parts))


def _subscript_name(node: ast.Subscript) -> str:
    value = ""
    if isinstance(node.value, ast.Name):
        value = node.value.id
    elif isinstance(node.value, ast.Attribute):
        value = _attr_name(node.value)
    slice_val = ""
    if isinstance(node.slice, ast.Name):
        slice_val = node.slice.id
    elif isinstance(node.slice, ast.Subscript):
        slice_val = _subscript_name(node.slice)
    elif isinstance(node.slice, ast.Tuple):
        elts = []
        for elt in node.slice.elts:
            if isinstance(elt, ast.Name):
                elts.append(elt.id)
            elif isinstance(elt, ast.Subscript):
                elts.append(_subscript_name(elt))
            elif isinstance(elt, ast.Attribute):
                elts.append(_attr_name(elt))
        slice_val = ", ".join(elts)
    if value and slice_val:
        return f"{value}[{slice_val}]"
    return value


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"files": {}}))
            return

        input_data = json.loads(raw)
        file_list = input_data.get("files", [])

        result: dict = {}
        for entry in file_list:
            abs_path = entry.get("absolutePath", "")
            rel_path = entry.get("relativePath", "")
            if not abs_path or not rel_path:
                continue

            info = extract_file_info(abs_path, rel_path)
            if info is None:
                info = {
                    "nodes": [],
                    "edges": [],
                    "imports": [],
                    "summary": "Parse error",
                }

            result[rel_path] = info

        print(json.dumps({"files": result}))

    except Exception as exc:
        print(json.dumps({"error": str(exc), "traceback": traceback.format_exc()}))
        sys.exit(1)


if __name__ == "__main__":
    main()
