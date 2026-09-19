/* Built from the PASSENGER DETAILS sheet. Names, gender, dates of birth and the
   relationships implied by the Role column and the patronymics. Passport
   numbers, NRIC and phone numbers are deliberately left out. */
function P(id, name, gender, birth) {
  return { person_id: id, display_name: name, full_name: name,
           given_name: name.split(' ')[0], gender, birth_date: birth,
           birth_precision: 'exact', is_living: 'TRUE', status: 'active' };
}
let ls = 0, us = 0;
const par = (c, p, role) => ({ link_id: 'L' + (++ls), child_id: c, parent_id: p,
  parent_role: role, relation_type: 'biological', status: 'active' });
const uni = (a, b) => ({ union_id: 'U' + (++us), partner_a_id: a, partner_b_id: b,
  union_type: 'nikah', status: 'current', order_index: 1 });

const people = [
  P('S01', "MOHAMED SALIM BIN ALI", 'M', '1960-05-24'),
  P('S02', "SA'DIAH BTE ALIMON", 'F', '1962-07-09'),
  P('S03', "SITI SU'AIDAH BINTE MOHAMED SALIM", 'F', '1986-12-31'),
  P('S04', "NUR ABDUL KARIM BIN KAMARUDDIN", 'M', '1988-03-24'),
  P('S05', "SITI SYAHIRAH BINTE MOHAMED SALIM", 'F', '1990-08-03'),
  P('S06', "AMALI AFIQ BIN NOR ANUAR", 'M', '1990-10-26'),
  P('S07', "SAIFUL AZWAN BIN MOHAMED SALIM", 'M', '1992-06-03'),
  P('S08', "NUR FARIHIN BINTE KAMAL", 'F', '1992-09-29'),
  P('S09', "SITI SYAZWANI BINTE MOHAMED SALIM", 'F', '1998-05-30'),
  P('S10', "NAZRUL HAQUE BIN ABDOLAH", 'M', '1998-09-24'),
  P('S11', "AQILAH SYUKAIRAH BINTI NUR ABDUL KARIM", 'F', '2013-03-20'),
  P('S12', "AMNA SAFIRAH BINTE NUR ABDUL KARIM", 'F', '2015-11-02'),
  P('S13', "ANWARA SUMAYYAH BINTE NUR ABDUL KARIM", 'F', '2020-09-03'),
  P('S14', "BILAL SAIF BIN SAIFUL AZWAN", 'M', '2021-04-29'),
  P('S15', "NUR ABBAS SYAKUR BIN NUR ABDUL KARIM", 'M', '2022-06-05'),
  P('S16', "MUHAMMAD HADI BIN AMALI AFIQ", 'M', '2024-01-10'),
  P('S17', "NURUL HUDA BINTE AMALI AFIQ", 'F', '2024-01-10'),
  P('S18', "UMAR SAIF BIN SAIFUL AZWAN", 'M', '2024-03-22')
];

const unions = [uni('S01','S02'), uni('S03','S04'), uni('S05','S06'),
                uni('S07','S08'), uni('S09','S10')];
const parentage = [];
['S03','S05','S07','S09'].forEach(c => { parentage.push(par(c,'S01','father'), par(c,'S02','mother')); });
['S11','S12','S13','S15'].forEach(c => { parentage.push(par(c,'S04','father'), par(c,'S03','mother')); });
['S16','S17'].forEach(c => { parentage.push(par(c,'S06','father'), par(c,'S05','mother')); });
['S14','S18'].forEach(c => { parentage.push(par(c,'S07','father'), par(c,'S08','mother')); });

module.exports = { buildFamily: () => ({ people, parentage, unions, customTitles: [] }) };
