/**
 * A three-generation test family, built to exercise the cases that actually
 * break kinship engines: five siblings whose birth order decides their Malay
 * titles, relatives on both the father's and the mother's side (which Arabic
 * distinguishes and English does not), a marriage into the family, and a
 * cousin-once-removed in the youngest generation.
 */

function person(id, name, gender, birth, extra) {
  return Object.assign({
    person_id: id,
    display_name: name,
    full_name: name,
    given_name: name.split(' ')[0],
    gender: gender,
    birth_date: birth,
    birth_precision: birth ? 'exact' : 'unknown',
    is_living: 'TRUE',
    status: 'active'
  }, extra || {});
}

let linkSeq = 0;
function parent(childId, parentId, role, type) {
  linkSeq += 1;
  return {
    link_id: 'L' + linkSeq,
    child_id: childId,
    parent_id: parentId,
    parent_role: role,
    relation_type: type || 'biological',
    status: 'active'
  };
}

let unionSeq = 0;
function union(a, b, status, order) {
  unionSeq += 1;
  return {
    union_id: 'U' + unionSeq,
    partner_a_id: a,
    partner_b_id: b,
    union_type: 'nikah',
    status: status || 'current',
    order_index: order || 1
  };
}

function couple(people, parentage, unions, fatherId, motherId, children) {
  unions.push(union(fatherId, motherId));
  children.forEach(function (childId) {
    parentage.push(parent(childId, fatherId, 'father'));
    parentage.push(parent(childId, motherId, 'mother'));
  });
}

function buildFamily() {
  const people = [
    // Paternal grandparents.
    person('P001', 'Ismail bin Abdullah', 'M', '1920-03-02'),
    person('P002', 'Aminah binti Yaakob', 'F', '1924-07-19'),

    // Their five children, eldest first. This ordering is what turns into
    // Pak Long / Mak Ngah / Pak Su.
    person('P010', 'Osman bin Ismail', 'M', '1945-01-10'),
    person('P011', 'Fatimah binti Ismail', 'F', '1948-05-22'),
    person('P012', 'Rahim bin Ismail', 'M', '1951-11-03'),
    person('P013', 'Zainab binti Ismail', 'F', '1954-02-14'),
    person('P014', 'Sulaiman bin Ismail', 'M', '1958-09-30'),

    // Maternal grandparents and their two children.
    person('P003', 'Yusof bin Hamid', 'M', '1925-04-04'),
    person('P004', 'Halimah binti Omar', 'F', '1928-12-01'),
    person('P020', 'Salmah binti Yusof', 'F', '1950-06-15'),
    person('P021', 'Hassan bin Yusof', 'M', '1955-08-08'),

    // Married in.
    person('P030', 'Mariam binti Salleh', 'F', '1947-03-03'),

    // The middle generation.
    person('P040', 'Nurul binti Rahim', 'F', '1975-04-01'),
    person('P041', 'Karim bin Rahim', 'M', '1978-10-12'),
    person('P042', 'Faizal bin Rahim', 'M', '1982-01-25'),
    person('P043', 'Zaki bin Osman', 'M', '1970-07-07'),

    // Karim's wife and her father.
    person('P050', 'Aisha binti Ibrahim', 'F', '1980-02-20'),
    person('P051', 'Ibrahim bin Daud', 'M', '1952-05-05'),

    // The youngest generation, plus the family Hana marries into.
    person('P060', 'Hana binti Karim', 'F', '2005-09-09'),
    person('P061', 'Amir bin Latif', 'M', '2003-03-13'),
    person('P062', 'Latif bin Hamzah', 'M', '1974-06-06')
  ];

  const parentage = [];
  const unions = [];

  couple(people, parentage, unions, 'P001', 'P002', ['P010', 'P011', 'P012', 'P013', 'P014']);
  couple(people, parentage, unions, 'P003', 'P004', ['P020', 'P021']);
  couple(people, parentage, unions, 'P012', 'P020', ['P040', 'P041', 'P042']);
  couple(people, parentage, unions, 'P010', 'P030', ['P043']);
  couple(people, parentage, unions, 'P041', 'P050', ['P060']);
  parentage.push(parent('P050', 'P051', 'father'));
  parentage.push(parent('P061', 'P062', 'father'));
  unions.push(union('P060', 'P061'));

  return { people, parentage, unions, customTitles: [] };
}

module.exports = { buildFamily, person, parent, union };
