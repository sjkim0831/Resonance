/** Section Components Library */
import React from "react";
import { Card, CardHeader, CardContent, CardActions, Box, Typography, Button, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";

export const CardSection = ({ title, subtitle, children, actions }) => (
  <Card sx={{ mb: 2 }}>
    <CardHeader title={title} subheader={subtitle} />
    <CardContent>{children}</CardContent>
    {actions && <CardActions>{actions}</CardActions>}
  </Card>
);

export const TableSection = ({ title, columns, data, onRowClick, onAdd }) => (
  <Card sx={{ mb: 2 }}>
    <CardHeader title={title} action={onAdd && <Button startIcon=<Add /> onClick={onAdd}>Add</Button>} />
    <CardContent>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow>{columns.map(col => <TableCell key={col.field} sx={{ fontWeight: "bold" }}>{col.headerName}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {data?.map((row, i) => <TableRow key={i} hover onClick={() => onRowClick?.(row)}><TableCell><Button size="small">View</Button></TableCell></TableRow>)}
          </TableBody>
        </Table>
      </TableContainer>
    </CardContent>
  </Card>
);

export const FormSection = ({ title, children, onSubmit, onCancel }) => (
  <Card sx={{ mb: 2 }}>
    <CardHeader title={title} />
    <CardContent><Grid container spacing={2}>{children}</Grid></CardContent>
    <CardActions><Box display="flex" gap={1}>{onCancel && <Button onClick={onCancel}>Cancel</Button>}{onSubmit && <Button variant="contained" onClick={onSubmit}>Save</Button>}</Box></CardActions>
  </Card>
);