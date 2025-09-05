# Builds the combined AP6 ROM using SMJoin
# Auto launch b-em with /dev/smjoin-16kb - assumes VDFS configured to point to /dev/smjoin-16kb
./bin/b-em/b-em -autoboot -sp9 -vroot ./dev/smjoin-16kb
