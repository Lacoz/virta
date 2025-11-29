import { describe, expect, test } from "vitest";
import { bpmnToPipelineDefinition } from "../src/import.js";

const simpleBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   id="Definitions_1" 
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="true">
    <bpmn2:startEvent id="StartEvent_1"/>
    <bpmn2:serviceTask id="Task_1" name="Validate"/>
    <bpmn2:serviceTask id="Task_2" name="Process"/>
    <bpmn2:endEvent id="EndEvent_1"/>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2"/>
    <bpmn2:sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="EndEvent_1"/>
  </bpmn2:process>
</bpmn2:definitions>`;

describe("bpmnToPipelineDefinition", () => {
  test("converts simple BPMN process with linear flow", async () => {
    const result = await bpmnToPipelineDefinition(simpleBpmnXml);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]?.id).toBe("Task_1");
    expect(result.nodes[0]?.type).toBe("task");
    expect(result.nodes[0]?.dependsOn).toEqual([]);

    expect(result.nodes[1]?.id).toBe("Task_2");
    expect(result.nodes[1]?.type).toBe("task");
    expect(result.nodes[1]?.dependsOn).toEqual(["Task_1"]);

    expect(result.entryNodes).toContain("Task_1");
  });

  test("converts BPMN with parallel gateway", async () => {
    const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   id="Definitions_1" 
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="true">
    <bpmn2:startEvent id="StartEvent_1"/>
    <bpmn2:serviceTask id="Task_1" name="Start"/>
    <bpmn2:parallelGateway id="Gateway_1"/>
    <bpmn2:serviceTask id="Task_2" name="Branch1"/>
    <bpmn2:serviceTask id="Task_3" name="Branch2"/>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1"/>
    <bpmn2:sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="Task_2"/>
    <bpmn2:sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="Task_3"/>
  </bpmn2:process>
</bpmn2:definitions>`;

    const result = await bpmnToPipelineDefinition(bpmnXml);

    expect(result.nodes.length).toBeGreaterThanOrEqual(3);
    const gateway = result.nodes.find((n) => n.id === "Gateway_1");
    expect(gateway?.type).toBe("parallel");
  });

  test("converts BPMN with exclusive gateway", async () => {
    const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   id="Definitions_1" 
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="true">
    <bpmn2:startEvent id="StartEvent_1"/>
    <bpmn2:exclusiveGateway id="Gateway_1"/>
    <bpmn2:serviceTask id="Task_1" name="Path1"/>
    <bpmn2:serviceTask id="Task_2" name="Path2"/>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Gateway_1"/>
    <bpmn2:sequenceFlow id="Flow_2" sourceRef="Gateway_1" targetRef="Task_1"/>
    <bpmn2:sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="Task_2"/>
  </bpmn2:process>
</bpmn2:definitions>`;

    const result = await bpmnToPipelineDefinition(bpmnXml);

    const gateway = result.nodes.find((n) => n.id === "Gateway_1");
    expect(gateway?.type).toBe("choice");
  });

  test("preserves BPMN element config", async () => {
    const result = await bpmnToPipelineDefinition(simpleBpmnXml);

    expect(result.nodes[0]?.config).toBeDefined();
    const config = result.nodes[0]?.config as any;
    expect(config.bpmnType).toBe("bpmn:ServiceTask");
    expect(config.name).toBe("Validate");
  });

  test("throws error for invalid BPMN XML", async () => {
    const invalidXml = "<?xml version='1.0'?><invalid></invalid>";

    await expect(bpmnToPipelineDefinition(invalidXml)).rejects.toThrow(
      "Failed to parse BPMN XML"
    );
  });

  test("throws error for BPMN without process", async () => {
    const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   id="Definitions_1" 
                   targetNamespace="http://bpmn.io/schema/bpmn">
</bpmn2:definitions>`;

    await expect(bpmnToPipelineDefinition(bpmnXml)).rejects.toThrow(
      "does not contain a valid process"
    );
  });
});


