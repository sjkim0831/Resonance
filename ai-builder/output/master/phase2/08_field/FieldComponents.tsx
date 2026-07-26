/** Field Components Library - 20 Types */
import React, { useState } from "react";
import { TextField, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel, Switch, Radio, RadioGroup, FormLabel, Slider, Autocomplete, Box } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

export const FieldFactory = ({ type, value, onChange, options, label, required, error, ...props }) => {
  switch (type?.toUpperCase()) {
    case "TEXT": return <TextField value={value || ""} onChange={(e) => onChange?.(e.target.value)} fullWidth {...props} />;
    case "NUMBER": return <TextField type="number" value={value ?? ""} onChange={(e) => onChange?.(parseFloat(e.target.value))} fullWidth {...props} />;
    case "SELECT": return <FormControl fullWidth><InputLabel>{label}</InputLabel><Select value={value || ""} onChange={(e) => onChange?.(e.target.value)} label={label}>{options?.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}</Select></FormControl>;
    case "CHECKBOX": return <FormControlLabel control={<Checkbox checked={!!value} onChange={(e) => onChange?.(e.target.checked)} />} label={label} />;
    case "SWITCH": return <FormControlLabel control={<Switch checked={!!value} onChange={(e) => onChange?.(e.target.checked)} />} label={label} />;
    case "RADIO": return <FormControl><FormLabel>{label}</FormLabel><RadioGroup value={value || ""} onChange={(e) => onChange?.(e.target.value)}>{options?.map(o => <FormControlLabel key={o.value} value={o.value} control={<Radio />} label={o.label} />)}</RadioGroup></FormControl>;
    case "AUTOCOMPLETE": return <Autocomplete value={value} onChange={(_, v) => onChange?.(v)} options={options || []} getOptionLabel={(o) => typeof o === "string" ? o : o.label || o.value} renderInput={(params) => <TextField {...params} label={label} />} />;
    case "SLIDER": return <Box sx={{ width: "100%" }}><Slider value={value ?? 0} onChange={(_, v) => onChange?.(v)} {...props} /></Box>;
    case "EMAIL": return <TextField type="email" value={value || ""} onChange={(e) => onChange?.(e.target.value)} fullWidth {...props} />;
    case "PASSWORD": return <TextField type="password" value={value || ""} onChange={(e) => onChange?.(e.target.value)} fullWidth {...props} />;
    case "PHONE": return <TextField value={value || ""} onChange={(e) => onChange?.(e.target.value)} placeholder="010-0000-0000" fullWidth {...props} />;
    case "TEXTAREA": return <TextField value={value || ""} onChange={(e) => onChange?.(e.target.value)} multiline rows={4} fullWidth {...props} />;
    case "ADDRESS": return <TextField value={value?.base || value || ""} onChange={(e) => onChange?.({ ...value, base: e.target.value })} placeholder="Address" fullWidth {...props} />;
    default: return <TextField value={value || ""} onChange={(e) => onChange?.(e.target.value)} fullWidth {...props} />;
  }
};