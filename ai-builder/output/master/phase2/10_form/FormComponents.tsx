/** Form Components */
import React from "react";
import { Box, Button, Grid, Typography, Card, CardContent, CardActions, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import { FieldFactory } from "./FieldComponents";

export const AutoForm = ({ fields, values = {}, onSubmit, readonly = false, columns = 2 }) => {
  const [formData, setFormData] = React.useState(values);
  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  return (
    <Box>
      <Grid container spacing={2}>
        {fields.map((field) => (
          <Grid item xs={12} md={12 / columns} key={field.name}>
            <Typography variant="caption">{field.label}{field.required && <span style={{color:"red"}}> *</span>}</Typography>
            <FieldFactory type={field.type} value={formData[field.name]} onChange={(v) => handleChange(field.name, v)} options={field.options} disabled={readonly} />
          </Grid>
        ))}
      </Grid>
      {!readonly && <Box display="flex" gap={1} justifyContent="flex-end" mt={3}><Button onClick={() => onSubmit?.(formData)} variant="contained">Save</Button></Box>}
    </Box>
  );
};

export const FormArray = ({ label, template, values = [], onChange, readonly = false, minItems = 0, maxItems = 10 }) => {
  const [items, setItems] = React.useState(values);
  const addItem = () => { if (items.length < maxItems) { const newItem = {}; template.forEach(f => newItem[f.name] = ""); const updated = [...items, newItem]; setItems(updated); onChange?.(updated); } };
  const removeItem = (i) => { if (items.length > minItems) { const updated = items.filter((_, idx) => idx !== i); setItems(updated); onChange?.(updated); } };
  const updateItem = (i, field, value) => { const updated = [...items]; updated[i] = { ...updated[i], [field]: value }; setItems(updated); onChange?.(updated); };
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" mb={2}><Typography>{label} ({items.length})</Typography>{!readonly && <Button size="small" startIcon=<Add /> onClick={addItem}>Add</Button>}</Box>
        {items.length === 0 ? <Typography color="textSecondary">No items</Typography> : (
          <TableContainer><Table size="small"><TableHead><TableRow>{template.map(f => <TableCell key={f.name}>{f.label}</TableCell>)}</TableRow></TableHead><TableBody>
            {items.map((item, i) => <TableRow key={i}>{template.map(f => <TableCell key={f.name}><FieldFactory type={f.type} value={item[f.name]} onChange={(v) => updateItem(i, f.name, v)} /></TableCell>)}
              {!readonly && <TableCell><IconButton size="small" onClick={() => removeItem(i)} disabled={items.length <= minItems}><Delete fontSize="small" /></IconButton></TableCell>}
            </TableRow></TableBody></Table></TableContainer>
        )}
      </CardContent>
    </Card>
  );
};