const Theatre = require('../models/Theatre');
const Show = require('../models/Show');
const { asyncHandler, httpError } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const filter = req.query.city ? { city: req.query.city } : {};
  res.json(await Theatre.find(filter).sort({ city: 1, name: 1 }));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await Theatre.create(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  const t = await Theatre.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!t) throw httpError(404, 'Theatre not found.');
  res.json(t);
});

exports.remove = asyncHandler(async (req, res) => {
  const upcoming = await Show.countDocuments({ theatre: req.params.id, startTime: { $gte: new Date() } });
  if (upcoming > 0) throw httpError(409, `This theatre has ${upcoming} upcoming shows. Delete those shows first.`);
  const t = await Theatre.findByIdAndDelete(req.params.id);
  if (!t) throw httpError(404, 'Theatre not found.');
  res.json({ message: 'Theatre deleted.' });
});
