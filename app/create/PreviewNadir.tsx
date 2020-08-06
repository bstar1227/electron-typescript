import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';

import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { Pannellum } from '360-react-pannellum';

import {
  setSequenceCurrentStep,
  selPoints,
  selSequence,
  selSequenceName,
} from './slice';

const { ipcRenderer } = window.require('electron');

export default function SequencePreviewNadir() {
  const dispatch = useDispatch();
  const points = useSelector(selPoints);
  const sequence = useSelector(selSequence);
  const name = useSelector(selSequenceName);
  const point = points[0];

  const resetMode = () => {
    dispatch(setSequenceCurrentStep('nadir'));
  };

  const confirmMode = () => {
    ipcRenderer.send('update_images', sequence);
    dispatch(setSequenceCurrentStep('processPage'));
  };

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h6" align="center" color="textSecondary">
          Preview Nadir
        </Typography>
        <Typography variant="h6" align="center" color="textSecondary">
          Here’s an example of how your nadir will appear
        </Typography>
      </Grid>
      <Grid item xs={12} style={{ paddingBottom: '30px' }}>
        <Typography align="center" color="textSecondary" />
      </Grid>
      <Grid item xs={12}>
        <Pannellum
          width="100%"
          height="200px"
          imagePath="https://pannellum.org/images/alma.jpg"
          closeButtonTitle="Close"
          showZoomCtrl={false}
          showFullscreenCtrl={false}
          autoLoad
        />
      </Grid>
      <Grid item xs={12}>
        <Box mr={1} display="inline-block">
          <Button
            endIcon={<ChevronRightIcon />}
            color="secondary"
            onClick={resetMode}
            variant="contained"
          >
            Use other nadir
          </Button>
        </Box>
        <Button
          endIcon={<ChevronRightIcon />}
          color="primary"
          onClick={confirmMode}
          variant="contained"
        >
          Confirm nadir
        </Button>
      </Grid>
    </>
  );
}