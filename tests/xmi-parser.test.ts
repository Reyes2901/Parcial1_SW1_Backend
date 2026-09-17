import { describe, it, expect } from 'vitest';
import { parseXMI } from '../src/modules/import/xmi-parser';

describe('XMI Parser', () => {
  it('parses valid XMI XML into UMLCommands', () => {
    const sampleXmi = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:uml="http://www.eclipse.org/uml2/3.0.0/UML">
  <uml:Model xmi:id="_0" name="LibrarySystem">
    <packagedElement xmi:type="uml:Class" xmi:id="class_book" name="Book">
      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_title" name="title" visibility="public">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/UML.xmi#String"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_pages" name="pages" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/UML.xmi#Integer"/>
      </ownedAttribute>
    </packagedElement>
    <packagedElement xmi:type="uml:Class" xmi:id="class_author" name="Author">
      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_name" name="name" visibility="public">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20090901/UML.xmi#String"/>
      </ownedAttribute>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const result = parseXMI(sampleXmi);
    expect(result.commands.length).toBe(2);

    const bookCmd = result.commands.find((c) => c.type === 'add_class' && c.name === 'Book') as any;
    expect(bookCmd).toBeDefined();
    expect(bookCmd.attributes).toHaveLength(2);
    expect(bookCmd.attributes[0].name).toBe('title');
    expect(bookCmd.attributes[0].type).toBe('String');
    expect(bookCmd.attributes[1].name).toBe('pages');
    expect(bookCmd.attributes[1].type).toBe('Integer');
  });
});
