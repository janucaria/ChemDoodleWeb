//
// ChemDoodle Web Components 8.0.0
//
// http://web.chemdoodle.com
//
// Copyright 2009-2017 iChemLabs, LLC.  All rights reserved.
//
// The ChemDoodle Web Components library is licensed under version 3
// of the GNU GENERAL PUBLIC LICENSE.
//
// You may redistribute it and/or modify it under the terms of the
// GNU General Public License as published by the Free Software Foundation,
// either version 3 of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
// Please contact iChemLabs <http://www.ichemlabs.com/contact-us> for
// alternate licensing options.
//

import * as lib from './ChemDoodle/lib';
import * as extensions from './ChemDoodle/extensions';
import * as structures from './ChemDoodle/structures';
import * as math from './ChemDoodle/math';
import * as informatics from './ChemDoodle/informatics';
import * as io from './ChemDoodle/io';
import animations from './ChemDoodle/animations';
import featureDetection from './ChemDoodle/featureDetection';
import monitor from './ChemDoodle/monitor';
import iChemLabs from './ChemDoodle/iChemLabs';
import * as ChemDoodleWeb from './ChemDoodle';

export var ChemDoodle = ChemDoodleWeb;

ChemDoodle.iChemLabs = iChemLabs;

ChemDoodle.informatics = informatics;

ChemDoodle.io = io;

ChemDoodle.lib = lib;
ChemDoodle.notations = {};

ChemDoodle.structures = structures;

ChemDoodle.animations = animations;

ChemDoodle.extensions = extensions;

ChemDoodle.math = math;

ChemDoodle.featureDetection = featureDetection;

(function(c, extensions, io, structures, ELEMENT, trim, m, undefined) {
	'use strict';
	function checkContained(residue, set, chainID, index, helix) {
		for ( var j = 0, jj = set.length; j < jj; j++) {
			var check = set[j];
			if (check.id === chainID && index >= check.start && index <= check.end) {
				if (helix) {
					residue.helix = true;
				} else {
					residue.sheet = true;
				}
				if (index === check.end) {
					residue.arrow = true;
				}
				return;
			}
		}
	}
	
	io.PDBInterpreter = function() {
	};
	var _ = io.PDBInterpreter.prototype = new io._Interpreter();
	_.calculateRibbonDistances = false;
	_.deduceResidueBonds = false;
	_.read = function(content, multiplier) {
		var molecule = new structures.Molecule();
		molecule.chains = [];
		if (!content) {
			return molecule;
		}
		var currentTagTokens = content.split('\n');
		if (!multiplier) {
			multiplier = 1;
		}
		var helices = [];
		var sheets = [];
		var lastC;
		var currentChain = [];
		var resatoms = [];
		var atomSerials = [];
		for ( var i = 0, ii = currentTagTokens.length; i < ii; i++) {
			var line = currentTagTokens[i];
			if (extensions.stringStartsWith(line, 'HELIX')) {
				helices.push({
					id : line.substring(19, 20),
					start : parseInt(line.substring(21, 25)),
					end : parseInt(line.substring(33, 37))
				});
			} else if (extensions.stringStartsWith(line, 'SHEET')) {
				sheets.push({
					id : line.substring(21, 22),
					start : parseInt(line.substring(22, 26)),
					end : parseInt(line.substring(33, 37))
				});
			} else if (extensions.stringStartsWith(line, 'ATOM')) {
				var altLoc = line.substring(16, 17);
				if (altLoc === ' ' || altLoc === 'A') {
					var label = trim(line.substring(76, 78));
					if (label.length === 0) {
						var s = trim(line.substring(12, 14));
						if (s === 'HD') {
							label = 'H';
						} else if (s.length > 0) {
							if (s.length > 1) {
								label = s.charAt(0) + s.substring(1).toLowerCase();
							} else {
								label = s;
							}
						}
					}
					var a = new structures.Atom(label, parseFloat(line.substring(30, 38)) * multiplier, parseFloat(line.substring(38, 46)) * multiplier, parseFloat(line.substring(46, 54)) * multiplier);
					a.hetatm = false;
					resatoms.push(a);
					// set up residue
					var resSeq = parseInt(line.substring(22, 26));
					if (currentChain.length === 0) {
						for ( var j = 0; j < 3; j++) {
							var dummyFront = new structures.Residue(-1);
							dummyFront.cp1 = a;
							dummyFront.cp2 = a;
							currentChain.push(dummyFront);
						}
					}
					if (resSeq !== Number.NaN && currentChain[currentChain.length - 1].resSeq !== resSeq) {
						var r = new structures.Residue(resSeq);
						r.name = trim(line.substring(17, 20));
						if (r.name.length === 3) {
							r.name = r.name.substring(0, 1) + r.name.substring(1).toLowerCase();
						} else {
							if (r.name.length === 2 && r.name.charAt(0) === 'D') {
								r.name = r.name.substring(1);
							}
						}
						currentChain.push(r);
						var chainID = line.substring(21, 22);
						checkContained(r, helices, chainID, resSeq, true);
						checkContained(r, sheets, chainID, resSeq, false);
					}
					// end residue setup
					var atomName = trim(line.substring(12, 16));
					var currentResidue = currentChain[currentChain.length - 1];
					if (atomName === 'CA' || atomName === 'P' || atomName === 'O5\'') {
						if (!currentResidue.cp1) {
							currentResidue.cp1 = a;
						}
					} else if (atomName === 'N3' && (currentResidue.name === 'C' || currentResidue.name === 'U' || currentResidue.name === 'T') || atomName === 'N1' && (currentResidue.name === 'A' || currentResidue.name === 'G')) {
						// control points for base platform direction
						currentResidue.cp3 = a;
					} else if (atomName === 'C2') {
						// control points for base platform orientation
						currentResidue.cp4 = a;
					} else if (atomName === 'C4' && (currentResidue.name === 'C' || currentResidue.name === 'U' || currentResidue.name === 'T') || atomName === 'C6' && (currentResidue.name === 'A' || currentResidue.name === 'G')) {
						// control points for base platform orientation
						currentResidue.cp5 = a;
					} else if (atomName === 'O' || atomName === 'C6' && (currentResidue.name === 'C' || currentResidue.name === 'U' || currentResidue.name === 'T') || atomName === 'N9') {
						if (!currentChain[currentChain.length - 1].cp2) {
							if (atomName === 'C6' || atomName === 'N9') {
								lastC = a;
							}
							currentResidue.cp2 = a;
						}
					} else if (atomName === 'C') {
						lastC = a;
					}
				}
			} else if (extensions.stringStartsWith(line, 'HETATM')) {
				var symbol = trim(line.substring(76, 78));
				if (symbol.length === 0) {
					// handle the case where an improperly formatted PDB
					// file states the element label in the atom name column
					symbol = trim(line.substring(12, 16));
				}
				if (symbol.length > 1) {
					symbol = symbol.substring(0, 1) + symbol.substring(1).toLowerCase();
				}
				var het = new structures.Atom(symbol, parseFloat(line.substring(30, 38)) * multiplier, parseFloat(line.substring(38, 46)) * multiplier, parseFloat(line.substring(46, 54)) * multiplier);
				het.hetatm = true;
				var residueName = trim(line.substring(17, 20));
				if (residueName === 'HOH') {
					het.isWater = true;
				}
				molecule.atoms.push(het);
				atomSerials[parseInt(trim(line.substring(6, 11)))] = het;
			} else if (extensions.stringStartsWith(line, 'CONECT')) {
				var oid = parseInt(trim(line.substring(6, 11)));
				if (atomSerials[oid]) {
					var origin = atomSerials[oid];
					for ( var k = 0; k < 4; k++) {
						var next = trim(line.substring(11 + k * 5, 16 + k * 5));
						if (next.length !== 0) {
							var nid = parseInt(next);
							if (atomSerials[nid]) {
								var a2 = atomSerials[nid];
								var found = false;
								for ( var j = 0, jj = molecule.bonds.length; j < jj; j++) {
									var b = molecule.bonds[j];
									if (b.a1 === origin && b.a2 === a2 || b.a1 === a2 && b.a2 === origin) {
										found = true;
										break;
									}
								}
								if (!found) {
									molecule.bonds.push(new structures.Bond(origin, a2));
								}
							}
						}
					}
				}
			} else if (extensions.stringStartsWith(line, 'TER')) {
				this.endChain(molecule, currentChain, lastC, resatoms);
				currentChain = [];
			} else if (extensions.stringStartsWith(line, 'ENDMDL')) {
				break;
			}
		}
		this.endChain(molecule, currentChain, lastC, resatoms);
		if (molecule.bonds.size === 0) {
			new c.informatics.BondDeducer().deduceCovalentBonds(molecule, multiplier);
		}
		if (this.deduceResidueBonds) {
			for ( var i = 0, ii = resatoms.length; i < ii; i++) {
				var max = m.min(ii, i + 20);
				for ( var j = i + 1; j < max; j++) {
					var first = resatoms[i];
					var second = resatoms[j];
					if (first.distance3D(second) < (ELEMENT[first.label].covalentRadius + ELEMENT[second.label].covalentRadius) * 1.1) {
						molecule.bonds.push(new structures.Bond(first, second, 1));
					}
				}
			}
		}
		molecule.atoms = molecule.atoms.concat(resatoms);
		if (this.calculateRibbonDistances) {
			this.calculateDistances(molecule, resatoms);
		}
		return molecule;
	};
	_.endChain = function(molecule, chain, lastC, resatoms) {
		if (chain.length > 0) {
			var last = chain[chain.length - 1];
			if (!last.cp1) {
				last.cp1 = resatoms[resatoms.length - 2];
			}
			if (!last.cp2) {
				last.cp2 = resatoms[resatoms.length - 1];
			}
			for ( var i = 0; i < 4; i++) {
				var dummyEnd = new structures.Residue(-1);
				dummyEnd.cp1 = lastC;
				dummyEnd.cp2 = chain[chain.length - 1].cp2;
				chain.push(dummyEnd);
			}
			molecule.chains.push(chain);
		}
	};
	_.calculateDistances = function(molecule, resatoms) {
		var hetatm = [];
		for ( var i = 0, ii = molecule.atoms.length; i < ii; i++) {
			var a = molecule.atoms[i];
			if (a.hetatm) {
				if (!a.isWater) {
					hetatm.push(a);
				}
			}
		}
		for ( var i = 0, ii = resatoms.length; i < ii; i++) {
			var a = resatoms[i];
			a.closestDistance = Number.POSITIVE_INFINITY;
			if (hetatm.length === 0) {
				a.closestDistance = 0;
			} else {
				for ( var j = 0, jj = hetatm.length; j < jj; j++) {
					a.closestDistance = Math.min(a.closestDistance, a.distance3D(hetatm[j]));
				}
			}
		}
	};

	// shortcuts
	var interpreter = new io.PDBInterpreter();
	c.readPDB = function(content, multiplier) {
		return interpreter.read(content, multiplier);
	};

})(ChemDoodle, ChemDoodle.extensions, ChemDoodle.io, ChemDoodle.structures, ChemDoodle.ELEMENT, ChemDoodle.lib.jQuery.trim, Math);

(function(c, extensions, io, structures, q, undefined) {
	'use strict';
	var SQZ_HASH = {
		'@' : 0,
		'A' : 1,
		'B' : 2,
		'C' : 3,
		'D' : 4,
		'E' : 5,
		'F' : 6,
		'G' : 7,
		'H' : 8,
		'I' : 9,
		'a' : -1,
		'b' : -2,
		'c' : -3,
		'd' : -4,
		'e' : -5,
		'f' : -6,
		'g' : -7,
		'h' : -8,
		'i' : -9
	}, DIF_HASH = {
		'%' : 0,
		'J' : 1,
		'K' : 2,
		'L' : 3,
		'M' : 4,
		'N' : 5,
		'O' : 6,
		'P' : 7,
		'Q' : 8,
		'R' : 9,
		'j' : -1,
		'k' : -2,
		'l' : -3,
		'm' : -4,
		'n' : -5,
		'o' : -6,
		'p' : -7,
		'q' : -8,
		'r' : -9
	}, DUP_HASH = {
		'S' : 1,
		'T' : 2,
		'U' : 3,
		'V' : 4,
		'W' : 5,
		'X' : 6,
		'Y' : 7,
		'Z' : 8,
		's' : 9
	};

	io.JCAMPInterpreter = function() {
	};
	var _ = io.JCAMPInterpreter.prototype = new io._Interpreter();
	_.convertHZ2PPM = false;
	_.read = function(content) {
		this.isBreak = function(c) {
			// some of these arrays may return zero, so check if undefined
			return SQZ_HASH[c] !== undefined || DIF_HASH[c] !== undefined || DUP_HASH[c] !== undefined || c === ' ' || c === '-' || c === '+';
		};
		this.getValue = function(decipher, lastDif) {
			var first = decipher.charAt(0);
			var rest = decipher.substring(1);
			// some of these arrays may return zero, so check if undefined
			if (SQZ_HASH[first] !== undefined) {
				return parseFloat(SQZ_HASH[first] + rest);
			} else if (DIF_HASH[first] !== undefined) {
				return parseFloat(DIF_HASH[first] + rest) + lastDif;
			}
			return parseFloat(rest);
		};
		var spectrum = new structures.Spectrum();
		if (content === undefined || content.length === 0) {
			return spectrum;
		}
		var lines = content.split('\n');
		var sb = [];
		var xLast, xFirst, yFirst, nPoints, xFactor = 1, yFactor = 1, observeFrequency = 1, deltaX = -1, shiftOffsetNum = -1, shiftOffsetVal = -1;
		var recordMeta = true, divideByFrequency = false;
		for ( var i = 0, ii = lines.length; i < ii; i++) {
			var use = lines[i].trim();
			var index = use.indexOf('$$');
			if (index !== -1) {
				use = use.substring(0, index);
			}
			if (sb.length === 0 || !extensions.stringStartsWith(lines[i], '##')) {
				var trimmed = use.trim();
				if (sb.length !== 0 && trimmed.length!==0) {
					sb.push('\n');
				}
				sb.push(trimmed);
			} else {
				var currentRecord = sb.join('');
				if (recordMeta && currentRecord.length < 100) {
					spectrum.metadata.push(currentRecord);
				}
				sb = [ use ];
				if (extensions.stringStartsWith(currentRecord, '##TITLE=')) {
					spectrum.title = currentRecord.substring(8).trim();
				} else if (extensions.stringStartsWith(currentRecord, '##XUNITS=')) {
					spectrum.xUnit = currentRecord.substring(9).trim();
					if (this.convertHZ2PPM && spectrum.xUnit.toUpperCase() === 'HZ') {
						spectrum.xUnit = 'PPM';
						divideByFrequency = true;
					}
				} else if (extensions.stringStartsWith(currentRecord, '##YUNITS=')) {
					spectrum.yUnit = currentRecord.substring(9).trim();
				} else if (extensions.stringStartsWith(currentRecord, '##XYPAIRS=')) {
					// spectrum.yUnit = currentRecord.substring(9).trim();
				} else if (extensions.stringStartsWith(currentRecord, '##FIRSTX=')) {
					xFirst = parseFloat(currentRecord.substring(9).trim());
				} else if (extensions.stringStartsWith(currentRecord, '##LASTX=')) {
					xLast = parseFloat(currentRecord.substring(8).trim());
				} else if (extensions.stringStartsWith(currentRecord, '##FIRSTY=')) {
					yFirst = parseFloat(currentRecord.substring(9).trim());
				} else if (extensions.stringStartsWith(currentRecord, '##NPOINTS=')) {
					nPoints = parseFloat(currentRecord.substring(10).trim());
				} else if (extensions.stringStartsWith(currentRecord, '##XFACTOR=')) {
					xFactor = parseFloat(currentRecord.substring(10).trim());
				} else if (extensions.stringStartsWith(currentRecord, '##YFACTOR=')) {
					yFactor = parseFloat(currentRecord.substring(10).trim());
				} else if (extensions.stringStartsWith(currentRecord, '##DELTAX=')) {
					deltaX = parseFloat(currentRecord.substring(9).trim());
				} else if (extensions.stringStartsWith(currentRecord, '##.OBSERVE FREQUENCY=')) {
					if (this.convertHZ2PPM) {
						observeFrequency = parseFloat(currentRecord.substring(21).trim());
					}
				} else if (extensions.stringStartsWith(currentRecord, '##.SHIFT REFERENCE=')) {
					if (this.convertHZ2PPM) {
						var parts = currentRecord.substring(19).split(',');
						shiftOffsetNum = parseInt(parts[2].trim());
						shiftOffsetVal = parseFloat(parts[3].trim());
					}
				} else if (extensions.stringStartsWith(currentRecord, '##XYDATA=')) {
					if (!divideByFrequency) {
						observeFrequency = 1;
					}
					recordMeta = false;
					var lastWasDif = false;
					var innerLines = currentRecord.split('\n');
					var abscissaSpacing = (xLast - xFirst) / (nPoints - 1);
					var lastX = xFirst - abscissaSpacing;
					var lastY = yFirst;
					var lastDif = 0;
					var lastOrdinate;
					for ( var j = 1, jj = innerLines.length; j < jj; j++) {
						var data = [];
						var read = innerLines[j].trim();
						var sb = [];
						for ( var k = 0, kk = read.length; k < kk; k++) {
							if (this.isBreak(read.charAt(k))) {
								if (sb.length > 0 && !(sb.length === 1 && sb[0] === ' ')) {
									data.push(sb.join(''));
								}
								sb = [ read.charAt(k) ];
							} else {
								sb.push(read.charAt(k));
							}
						}
						data.push(sb.join(''));
						lastX = parseFloat(data[0]) * xFactor - abscissaSpacing;
						for ( var k = 1, kk = data.length; k < kk; k++) {
							var decipher = data[k];
							// some of these arrays may return zero, so
							// check if undefined
							if (DUP_HASH[decipher.charAt(0)] !== undefined) {
								// be careful when reading this, to keep
								// spectra efficient, DUPS are actually
								// discarded, except the last y!
								var dup = parseInt(DUP_HASH[decipher.charAt(0)] + decipher.substring(1)) - 1;
								for ( var l = 0; l < dup; l++) {
									lastX += abscissaSpacing;
									lastDif = this.getValue(lastOrdinate, lastDif);
									lastY = lastDif * yFactor;
									count++;
									spectrum.data[spectrum.data.length - 1] = new structures.Point(lastX / observeFrequency, lastY);
								}
							} else {
								// some of these arrays may return zero, so
								// check if undefined
								if (!(SQZ_HASH[decipher.charAt(0)] !== undefined && lastWasDif)) {
									lastWasDif = DIF_HASH[decipher.charAt(0)] !== undefined;
									lastOrdinate = decipher;
									lastX += abscissaSpacing;
									lastDif = this.getValue(decipher, lastDif);
									lastY = lastDif * yFactor;
									count++;
									spectrum.data.push(new structures.Point(lastX / observeFrequency, lastY));
								} else {
									lastY = this.getValue(decipher, lastDif) * yFactor;
								}
							}
						}
					}
					if (shiftOffsetNum !== -1) {
						var dif = shiftOffsetVal - spectrum.data[shiftOffsetNum - 1].x;
						for ( var i = 0, ii = spectrum.data.length; i < ii; i++) {
							spectrum.data[i].x += dif;
						}
					}
				} else if (extensions.stringStartsWith(currentRecord, '##PEAK TABLE=')) {
					recordMeta = false;
					spectrum.continuous = false;
					var innerLines = currentRecord.split('\n');
					var count = 0;
					var reg = /[\s,]+/;
					for ( var j = 1, jj = innerLines.length; j < jj; j++) {
						var items = innerLines[j].split(reg);
						count += items.length / 2;
						for ( var k = 0, kk = items.length; k + 1 < kk; k += 2) {
							spectrum.data.push(new structures.Point(parseFloat(items[k].trim()), parseFloat(items[k + 1].trim())));
						}
					}
				} else if (extensions.stringStartsWith(currentRecord, '##ATOMLIST=')) {
					spectrum.molecule = new structures.Molecule();
					var innerLines = currentRecord.split('\n');
					var reg = /[\s]+/;
					for ( var j = 1, jj = innerLines.length; j < jj; j++) {
						var items = innerLines[j].split(reg);
						spectrum.molecule.atoms.push(new structures.Atom(items[1]));
					}
				} else if (extensions.stringStartsWith(currentRecord, '##BONDLIST=')) {
					var innerLines = currentRecord.split('\n');
					var reg = /[\s]+/;
					for ( var j = 1, jj = innerLines.length; j < jj; j++) {
						var items = innerLines[j].split(reg);
						var order = 1;
						if(items[2]==='D'){
							order = 2;
						}else if(items[2]==='T'){
							order = 3;
						}
						spectrum.molecule.bonds.push(new structures.Bond(spectrum.molecule.atoms[parseInt(items[0])-1], spectrum.molecule.atoms[parseInt(items[1])-1], order));
					}
				} else if (spectrum.molecule && extensions.stringStartsWith(currentRecord, '##XY_RASTER=')) {
					var innerLines = currentRecord.split('\n');
					var reg = /[\s]+/;
					for ( var j = 1, jj = innerLines.length; j < jj; j++) {
						var items = innerLines[j].split(reg);
						var a = spectrum.molecule.atoms[parseInt(items[0])-1];
						a.x = parseInt(items[1]);
						a.y = parseInt(items[2]);
						if(items.length==4){
							a.z = parseInt(items[3]);
						}
					}
					spectrum.molecule.scaleToAverageBondLength(20);
				} else if (extensions.stringStartsWith(currentRecord, '##PEAK ASSIGNMENTS=')) {
					var innerLines = currentRecord.split('\n');
					var reg = /[\s,()<>]+/;
					spectrum.assignments = [];
					for ( var j = 1, jj = innerLines.length; j < jj; j++) {
						var items = innerLines[j].split(reg);
						var x = parseFloat(items[1]);
						var y = parseFloat(items[2]);
						var a = spectrum.molecule.atoms[parseInt(items[3])-1];
						var used = false;
						for(var k = 0, kk = spectrum.assignments.length; k<kk; k++){
							var assign = spectrum.assignments[k];
							if(assign.x === x){
								assign.as.push(a);
								a.assigned = assign;
								used = true;
								break;
							}
						}
						if(!used){
							var assign = {x:x, y:y, as:[a]};
							a.assigned = assign;
							spectrum.assignments.push(assign);
						}
					}
				}
			}
		}
		spectrum.setup();
		return spectrum;
	};
	_.makeStructureSpectrumSet = function(id, content) {
		this.convertHZ2PPM = true;
		var spectrum = this.read(content);
		var mcanvas = new c.ViewerCanvas(id+'_molecule', 200,200);
		mcanvas.specs.atoms_displayTerminalCarbonLabels_2D = true;
		mcanvas.specs.atoms_displayImplicitHydrogens_2D = true;
		mcanvas.mouseout = function(e){
			if(this.molecules.length!==0){
				for(var i = 0, ii = this.molecules[0].atoms.length; i<ii; i++){
					this.molecules[0].atoms[i].isHover = false;
				}
				spectrum.hovered = undefined;
				this.repaint();
				scanvas.repaint();
			}
		};
		mcanvas.touchend = mcanvas.mouseout;
		mcanvas.mousemove = function(e){
			if(this.molecules.length!==0){
				var closest=undefined;
				for(var i = 0, ii = this.molecules[0].atoms.length; i<ii; i++){
					var a = this.molecules[0].atoms[i];
					a.isHover = false;
					if(a.assigned && (closest===undefined || e.p.distance(a)<e.p.distance(closest))){
						closest = a;
					}
				}
				spectrum.hovered = undefined;
				if(e.p.distance(closest)<20){
					for(var i = 0, ii = closest.assigned.as.length; i<ii; i++){
						closest.assigned.as[i].isHover = true;
					}
					scanvas.spectrum.hovered = closest.assigned;
				}
				this.repaint();
				scanvas.repaint();
			}
		};
		mcanvas.touchmove = mcanvas.mousemove;
		mcanvas.drawChildExtras = function(ctx, specs){
			if(this.molecules.length!==0){
				for(var i = 0, ii = this.molecules[0].atoms.length; i<ii; i++){
					this.molecules[0].atoms[i].drawDecorations(ctx, specs);
				}
			}
		};
		var scanvas = new c.ObserverCanvas(id+'_spectrum', 400,200);
		scanvas.specs.plots_showYAxis = false;
		scanvas.specs.plots_flipXAxis = true;
		scanvas.mouseout = function(e){
			if(this.spectrum && this.spectrum.assignments){
				for(var i = 0, ii = mcanvas.molecules[0].atoms.length; i<ii; i++){
					mcanvas.molecules[0].atoms[i].isHover = false;
				}
				this.spectrum.hovered = undefined;
				mcanvas.repaint();
				this.repaint();
			}
		};
		scanvas.touchend = scanvas.mouseout;
		scanvas.mousemove = function(e){
			if(this.spectrum && this.spectrum.assignments){
				var closest=undefined;
				for(var i = 0, ii = mcanvas.molecules[0].atoms.length; i<ii; i++){
					mcanvas.molecules[0].atoms[i].isHover = false;
				}
				this.spectrum.hovered = undefined;
				for(var i = 0, ii = this.spectrum.assignments.length; i<ii; i++){
					var a = this.spectrum.assignments[i];
					if(closest===undefined || Math.abs(this.spectrum.getTransformedX(a.x, this.specs, this.spectrum.memory.width, this.spectrum.memory.offsetLeft)-e.p.x)<Math.abs(this.spectrum.getTransformedX(closest.x, this.specs, this.spectrum.memory.width, this.spectrum.memory.offsetLeft)-e.p.x)){
						closest = a;
					}
				}
				if(Math.abs(this.spectrum.getTransformedX(closest.x, this.specs, this.spectrum.memory.width, this.spectrum.memory.offsetLeft)-e.p.x)<20){
					for(var i = 0, ii = closest.as.length; i<ii; i++){
						closest.as[i].isHover = true;
					}
					this.spectrum.hovered = closest;
				}
				mcanvas.repaint();
				this.repaint();
			}
		};
		scanvas.touchmove = scanvas.mousemove;
		scanvas.drawChildExtras = function(ctx){
			if(this.spectrum && this.spectrum.hovered){
				var x = this.spectrum.getTransformedX(this.spectrum.hovered.x, scanvas.specs, this.spectrum.memory.width, this.spectrum.memory.offsetLeft);
				if (x >= this.spectrum.memory.offsetLeft && x < this.spectrum.memory.width) {
					ctx.save();
					ctx.strokeStyle='#885110';
					ctx.lineWidth = 3;
					ctx.beginPath();
					ctx.moveTo(x, this.spectrum.memory.height - this.spectrum.memory.offsetBottom);
					ctx.lineTo(x, this.spectrum.getTransformedY(this.spectrum.hovered.y, scanvas.specs, this.spectrum.memory.height, this.spectrum.memory.offsetBottom, this.spectrum.memory.offsetTop));
					ctx.stroke();
					ctx.restore();
				}
			}
		};
		if(spectrum){
			scanvas.loadSpectrum(spectrum);
			if(spectrum.molecule){
				mcanvas.loadMolecule(spectrum.molecule);
			}
		}
		return [mcanvas, scanvas];
	};

	// shortcuts
	var interpreter = new io.JCAMPInterpreter();
	interpreter.convertHZ2PPM = true;
	c.readJCAMP = function(content) {
		return interpreter.read(content);
	};
})(ChemDoodle, ChemDoodle.extensions, ChemDoodle.io, ChemDoodle.structures, ChemDoodle.lib.jQuery);

(function(c, io, structures, undefined) {
	'use strict';
	io.RXNInterpreter = function() {
	};
	var _ = io.RXNInterpreter.prototype = new io._Interpreter();
	_.read = function(content, multiplier) {
		if (!multiplier) {
			multiplier = c.default_bondLength_2D;
		}
		var molecules = [];
		var line;
		if (!content) {
			molecules.push(new structures.Molecule());
			line = new structures.d2.Line(new structures.Point(-20, 0), new structures.Point(20, 0));
		} else {
			var contentTokens = content.split('$MOL\n');
			var headerTokens = contentTokens[0].split('\n');
			var counts = headerTokens[4];
			var numReactants = parseInt(counts.substring(0, 3));
			var numProducts = parseInt(counts.substring(3, 6));
			var currentMolecule = 1;
			var start = 0;
			for ( var i = 0, ii = numReactants + numProducts; i < ii; i++) {
				molecules[i] = c.readMOL(contentTokens[currentMolecule], multiplier);
				var b = molecules[i].getBounds();
				var width = b.maxX - b.minX;
				start -= width + 40;
				currentMolecule++;
			}
			for ( var i = 0, ii = numReactants; i < ii; i++) {
				var b = molecules[i].getBounds();
				var width = b.maxX - b.minX;
				var center = molecules[i].getCenter();
				for ( var j = 0, jj = molecules[i].atoms.length; j < jj; j++) {
					var a = molecules[i].atoms[j];
					a.x += start + (width / 2) - center.x;
					a.y -= center.y;
				}
				start += width + 40;
			}
			line = new structures.d2.Line(new structures.Point(start, 0), new structures.Point(start + 40, 0));
			start += 80;
			for ( var i = numReactants, ii = numReactants + numProducts; i < ii; i++) {
				var b = molecules[i].getBounds();
				var width = b.maxX - b.minX;
				var center = molecules[i].getCenter();
				for ( var j = 0; j < molecules[i].atoms.length; j++) {
					var a = molecules[i].atoms[j];
					a.x += start + (width / 2) - center.x;
					a.y -= center.y;
				}
				start += width + 40;
			}
		}
		line.arrowType = structures.d2.Line.ARROW_SYNTHETIC;
		return {
			'molecules' : molecules,
			'shapes' : [ line ]
		};
	};
	_.write = function(mols, shapes) {
		var molecules = [ [], [] ];
		var ps = undefined;
		if (!mols || !shapes) {
			return;
		}
		for (i = 0, ii = shapes.length; i < ii; i++) {
			if (shapes[i] instanceof structures.d2.Line) {
				ps = shapes[i].getPoints();
				break;
			}
		}
		if (!ps) {
			return '';
		}
		for ( var i = 0, ii = mols.length; i < ii; i++) {
			var center = mols[i].getCenter();
			if (center.x < ps[1].x) {
				molecules[0].push(mols[i]);
			} else {
				molecules[1].push(mols[i]);
			}
		}
		var sb = [];
		sb.push('$RXN\nReaction from ChemDoodle Web Components\n\nhttp://www.ichemlabs.com\n');
		sb.push(this.fit(molecules[0].length.toString(), 3));
		sb.push(this.fit(molecules[1].length.toString(), 3));
		sb.push('\n');
		for ( var i = 0; i < 2; i++) {
			for ( var j = 0, jj = molecules[i].length; j < jj; j++) {
				sb.push('$MOL\n');
				sb.push(c.writeMOL(molecules[i][j]));
				sb.push('\n');
			}
		}
		return sb.join('');
	};

	// shortcuts
	var interpreter = new io.RXNInterpreter();
	c.readRXN = function(content, multiplier) {
		return interpreter.read(content, multiplier);
	};
	c.writeRXN = function(mols, shapes) {
		return interpreter.write(mols, shapes);
	};

})(ChemDoodle, ChemDoodle.io, ChemDoodle.structures);

(function(c, ELEMENT, SYMBOLS, io, structures, trim, undefined) {
	'use strict';
	io.XYZInterpreter = function() {
	};
	var _ = io.XYZInterpreter.prototype = new io._Interpreter();
	_.deduceCovalentBonds = true;
	_.read = function(content) {
		var molecule = new structures.Molecule();
		if (!content) {
			return molecule;
		}
		var lines = content.split('\n');

		var numAtoms = parseInt(trim(lines[0]));

		for ( var i = 0; i < numAtoms; i++) {
			var line = lines[i + 2];
			var tokens = line.split(/\s+/g);
			molecule.atoms[i] = new structures.Atom(isNaN(tokens[0]) ? tokens[0] : SYMBOLS[parseInt(tokens[0]) - 1], parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
		}
		if (this.deduceCovalentBonds) {
			new c.informatics.BondDeducer().deduceCovalentBonds(molecule, 1);
		}
		return molecule;
	};

	// shortcuts
	var interpreter = new io.XYZInterpreter();
	c.readXYZ = function(content) {
		return interpreter.read(content);
	};

})(ChemDoodle, ChemDoodle.ELEMENT, ChemDoodle.SYMBOLS, ChemDoodle.io, ChemDoodle.structures, ChemDoodle.lib.jQuery.trim);

ChemDoodle.monitor = monitor;

(function(io, document, window, undefined) {
	'use strict';
	io.png = {};

	io.png.string = function(canvas) {
		// this will not work for WebGL canvases in some browsers
		// to fix that you need to set the "preserveDrawingBuffer" to true when
		// creating the WebGL context
		// note that this will cause performance issues on some platforms and is
		// therefore not done by default
		return document.getElementById(canvas.id).toDataURL('image/png');
	};

	io.png.open = function(canvas) {
		window.open(this.string(canvas));
	};

})(ChemDoodle.io, document, window);

(function(io, q, undefined) {
	'use strict';
	io.file = {};

	// this function will only work with files from the same origin it is being
	// called from, unless the receiving server supports XHR2
	io.file.content = function(url, callback) {
		q.get(url, '', callback);
	};

})(ChemDoodle.io, ChemDoodle.lib.jQuery);
