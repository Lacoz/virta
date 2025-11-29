/**
 * Type declarations for bpmn-moddle
 */
declare module "bpmn-moddle" {
  interface BpmnModdleOptions {
    [key: string]: unknown;
  }

  interface FromXMLResult {
    rootElement: unknown;
    warnings?: unknown[];
  }

  interface ToXMLResult {
    xml: string;
  }

  class BpmnModdle {
    constructor(options?: BpmnModdleOptions);
    
    fromXML(xml: string, options?: unknown): Promise<FromXMLResult>;
    toXML(element: unknown, options?: unknown): Promise<ToXMLResult>;
    
    create(type: string, properties?: Record<string, unknown>): unknown;
  }

  export default BpmnModdle;
}


