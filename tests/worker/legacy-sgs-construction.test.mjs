// L82: SGS Engineering power tools on Construction Gear World (29 Oct 2026). The car and van side stays on Car Gear World.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, RULES } from '../../tools/import-rules/sgs-construction.mjs';

const place = (name, feedCategory = '') => {
  const c = classify({ name, feedCategory });
  return c.reject ? 'out' : `${c.siteCategory}/${c.subcategory}${c.doubt ? ' (doubt)' : ''}`;
};

test('L82: power tools, air tools and their batteries go to CGW Power Tools', () => {
  assert.equal(place('Rikä RK40 40V Cordless Brushless Combi Drill | Body Only', 'Power Tools > Rikä RK40 40V Cordless Power Tools > Rikä'), 'Power Tools/Power Tools');
  assert.equal(place('Rikä RK20 4.0Ah Battery', 'Power Tools > Rikä RK20 20V > Rikä'), 'Power Tools/Power Tools');
  assert.equal(place('SGS 50 Litre Oil Free Air Compressor', 'Hardware > Tools > SGS'), 'Power Tools/Power Tools');
  assert.equal(place('SGS 1/2" Air Impact Wrench 1500Nm', 'Garage Equipment > Air Tools > SGS'), 'Power Tools/Power Tools');
  assert.equal(place('SGS 6 Inch Bench Grinder', 'Hardware > Tools > SGS'), 'Power Tools/Power Tools');
});

test('L82: hand tools and site equipment have their own CGW places', () => {
  assert.equal(place('SGS 1/2" Drive Torque Wrench 28-210Nm', 'Hand Tools > Torque Wrenches > SGS'), 'Hand Tools/Hand Tools');
  assert.equal(place('SGS 7 Drawer Roller Cabinet', 'Garage Equipment > Tool Storage > SGS'), 'Site Equipment/Site Equipment');
  assert.equal(place('SGS Diesel Space Heater 20kW', 'Heating > SGS'), 'Site Equipment/Site Equipment');
  assert.equal(place('SGS Rechargeable LED Work Light', 'Lighting > SGS'), 'Site Equipment/Lighting');
  assert.equal(place('SGS Bolt Cutter Set', 'Power Tools > SGS'), 'Power Tools/Power Tools (doubt)');
});

test('L82: cars and vans (AGW), garden machinery (GGW), fitness and spare parts stay out', () => {
  for (const [name, cat] of [
    ['SGS 22 Tonne Professional Pneumatic Air Service Trolley Jack', 'Business & Industrial > Material Handling > Lifts & Hoists > Jacks & Lift Trucks > SGS'],
    ['Volvo V50 Boot Replacement Gas strut', 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > NitroLift'],
    ['SGS Car Polisher 600W', 'Hardware > Tools > Polishers & Buffers > Rikä'],
    ["SGS Mechanic's Apprentice Tool Bag Kit | 145 Automotive Tools", 'Hand Tools > SGS'],
    ['SGS Engine Crane 2 Tonne', 'Garage Equipment > SGS'],
    ['Rikä 40V Cordless Lawn Mower', 'Garden > Rikä'],
    ['Rikä 20V Cordless Hedge Trimmer', 'Garden > Rikä'],
    ['SGS Folding Treadmill', 'Sports > Fitness > SGS'],
    ['Replacement Carbon Brushes for SGS Angle Grinder', 'Power Tools > SGS']
  ]) assert.equal(place(name, cat), 'out', name);
  assert.equal(RULES.advertiserId, 28807);
  assert.ok(RULES.shop.test('https://www.sgs-engineering.com/rika-rk40-combi-drill'));
});
