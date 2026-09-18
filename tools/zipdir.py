import zipfile, os, sys
src, out, inner = sys.argv[1], sys.argv[2], sys.argv[3]
z = zipfile.ZipFile(out, "w", zipfile.ZIP_STORED)
for n in sorted(os.listdir(os.path.join(src, inner))):
    z.write(os.path.join(src, inner, n), inner + "/" + n)
z.close()
