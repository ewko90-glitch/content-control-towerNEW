type ExecutivePrintWrapperProps = {
  printMode: boolean;
  workspaceSlug: string;
  generatedAt: string;
  cssText: string;
  children: React.ReactNode;
};

export function ExecutivePrintWrapper(props: ExecutivePrintWrapperProps) {
  return (
    <div id="executive-print-root">
      {props.printMode ? <style>{props.cssText}</style> : null}
      <div className="exec-print-only">
        <p className="text-base font-semibold">Content Control Tower — Executive Summary</p>
        <p className="text-xs">Workspace: {props.workspaceSlug}</p>
        <p className="text-xs">Generated: {props.generatedAt}</p>
      </div>
      {props.children}
    </div>
  );
}
